const pool = require("../../config/mysql");
const { logAcademicEvent } = require("../../utils/academicLedger");

/**
 * Fisher-Yates array shuffle utility
 */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * GET /api/v1/academic/quizzes/:id/status
 * Evaluates unlock status and prerequisites without starting an attempt
 */
async function getQuizUnlockStatus(req, res) {
  try {
    const quizId = req.params.id;
    const user = req.user;

    const [quizRows] = await pool.query(
      `SELECT q.*, t.quiz_enabled, t.subject_id, t.title AS topic_title
       FROM academic_quizzes q
       JOIN academic_topics t ON q.topic_id = t.topic_id
       WHERE q.quiz_id = ?`,
      [quizId],
    );

    if (quizRows.length === 0) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    const quiz = quizRows[0];
    const now = new Date();
    const lockReasons = [];

    // Rule 1: Topic quiz enabled
    const isTopicEnabled = Boolean(quiz.quiz_enabled);
    if (!isTopicEnabled) {
      lockReasons.push("Quiz is disabled for this topic.");
    }

    // Rule 2: Quiz status
    const isPublished = quiz.status === "Published";
    if (!isPublished) {
      lockReasons.push(`Quiz is currently in '${quiz.status}' status and has not been published.`);
    }

    // Rule 3: Availability window
    let isWindowOpen = true;
    if (quiz.open_at && now < new Date(quiz.open_at)) {
      isWindowOpen = false;
      lockReasons.push(`Quiz is scheduled to open on ${new Date(quiz.open_at).toLocaleString()}.`);
    }
    if (quiz.close_at && now > new Date(quiz.close_at)) {
      isWindowOpen = false;
      lockReasons.push(`Quiz closed on ${new Date(quiz.close_at).toLocaleString()}.`);
    }

    // Rule 4: Required study materials completion check
    const [uncompletedReq] = await pool.query(
      `SELECT m.material_id, m.title, m.type, m.position,
              COALESCE(p.percent, 0) AS current_percent,
              COALESCE(p.status, 'NOT_STARTED') AS progress_status
       FROM academic_materials m
       LEFT JOIN academic_material_progress p ON m.material_id = p.material_id AND p.person_id = ?
       WHERE m.topic_id = ? AND m.status = 'Published' AND m.required_flag = 1
         AND (p.completed_at IS NULL OR p.percent < 100)`,
      [user.user_id, quiz.topic_id],
    );

    const requiredCompleted = uncompletedReq.length === 0;
    if (!requiredCompleted) {
      lockReasons.push(
        `Incomplete required study material: ${uncompletedReq.length} required item(s) must be completed before attempting this quiz.`,
      );
    }

    // Rule 5: Attempt limit & previous results
    const [attemptStats] = await pool.query(
      `SELECT 
        COUNT(*) AS total_attempts,
        COUNT(CASE WHEN result = 'PASSED' THEN 1 END) AS passed_attempts,
        MAX(percentage) AS best_percentage
       FROM academic_attempts 
       WHERE quiz_id = ? AND person_id = ? AND status = 'SUBMITTED'`,
      [quizId, user.user_id],
    );

    const totalAttempts = attemptStats[0].total_attempts || 0;
    const passedAttempts = attemptStats[0].passed_attempts || 0;
    const bestPercentage = attemptStats[0].best_percentage ? parseFloat(attemptStats[0].best_percentage) : null;
    const maxAttempts = quiz.max_attempts || 3;
    const hasRemainingAttempts = totalAttempts < maxAttempts;

    if (!hasRemainingAttempts) {
      lockReasons.push(`Maximum attempt limit reached (${totalAttempts}/${maxAttempts}).`);
    }

    // Check for active in-progress attempt
    const [activeAttempts] = await pool.query(
      `SELECT attempt_id, attempt_number, started_at, expires_at
       FROM academic_attempts
       WHERE quiz_id = ? AND person_id = ? AND status = 'IN_PROGRESS'
       ORDER BY started_at DESC LIMIT 1`,
      [quizId, user.user_id],
    );

    let activeAttemptSummary = null;
    if (activeAttempts.length > 0) {
      const active = activeAttempts[0];
      const isExpired = active.expires_at && now > new Date(active.expires_at);
      if (!isExpired) {
        activeAttemptSummary = {
          attempt_id: active.attempt_id,
          attempt_number: active.attempt_number,
          started_at: active.started_at,
          expires_at: active.expires_at,
          remaining_seconds: Math.max(0, Math.floor((new Date(active.expires_at) - now) / 1000)),
        };
      }
    }

    const isUnlocked =
      isTopicEnabled &&
      isPublished &&
      isWindowOpen &&
      requiredCompleted &&
      (hasRemainingAttempts || activeAttemptSummary !== null);

    return res.status(200).json({
      success: true,
      data: {
        quiz_id: parseInt(quizId, 10),
        topic_id: quiz.topic_id,
        topic_title: quiz.topic_title,
        title: quiz.title,
        time_limit: quiz.time_limit,
        pass_mark: parseFloat(quiz.pass_mark),
        is_unlocked: isUnlocked,
        status: quiz.status,
        open_at: quiz.open_at,
        close_at: quiz.close_at,
        is_window_open: isWindowOpen,
        max_attempts: maxAttempts,
        attempts_taken: totalAttempts,
        remaining_attempts: Math.max(0, maxAttempts - totalAttempts),
        is_passed: passedAttempts > 0,
        best_percentage: bestPercentage,
        required_materials_completed: requiredCompleted,
        incomplete_required_materials: uncompletedReq,
        lock_reasons: lockReasons,
        active_attempt: activeAttemptSummary,
      },
    });
  } catch (err) {
    console.error("[AcademicAttempt] getQuizUnlockStatus error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * POST /api/v1/academic/quizzes/:id/attempts
 * Initiates an attempt enforcing all unlock rules
 */
async function startQuizAttempt(req, res) {
  try {
    const quizId = req.params.id;
    const user = req.user;

    // 1. Fetch quiz and topic
    const [quizRows] = await pool.query(
      `SELECT q.*, t.quiz_enabled, t.subject_id, t.title AS topic_title
       FROM academic_quizzes q
       JOIN academic_topics t ON q.topic_id = t.topic_id
       WHERE q.quiz_id = ?`,
      [quizId],
    );

    if (quizRows.length === 0) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    const quiz = quizRows[0];

    // Rule 1: Topic quiz enabled
    if (!quiz.quiz_enabled) {
      return res.status(403).json({
        success: false,
        message: "Quiz is disabled for this topic",
      });
    }

    // Rule 2: Quiz published
    if (quiz.status !== "Published") {
      return res.status(403).json({
        success: false,
        message: "Quiz is not published or currently in draft",
      });
    }

    const now = new Date();

    // Rule 3: Open / Close window
    if (quiz.open_at && now < new Date(quiz.open_at)) {
      return res.status(403).json({
        success: false,
        message: `Quiz is not yet open. It will open on ${new Date(quiz.open_at).toLocaleString()}`,
      });
    }

    if (quiz.close_at && now > new Date(quiz.close_at)) {
      return res.status(403).json({
        success: false,
        message: `Quiz has closed as of ${new Date(quiz.close_at).toLocaleString()}`,
      });
    }

    // Rule 4: Required study materials completion check
    const [uncompletedReq] = await pool.query(
      `SELECT m.material_id, m.title, m.type
       FROM academic_materials m
       LEFT JOIN academic_material_progress p ON m.material_id = p.material_id AND p.person_id = ?
       WHERE m.topic_id = ? AND m.status = 'Published' AND m.required_flag = 1
         AND (p.completed_at IS NULL OR p.percent < 100)`,
      [user.user_id, quiz.topic_id],
    );

    if (uncompletedReq.length > 0) {
      return res.status(403).json({
        success: false,
        code: "PREREQUISITES_NOT_MET",
        message: "Prerequisites not met. You must complete all required study materials before taking this quiz.",
        uncompleted_materials: uncompletedReq,
      });
    }

    // Check for an active, unexpired attempt to resume
    const [activeAttempts] = await pool.query(
      `SELECT * FROM academic_attempts 
       WHERE quiz_id = ? AND person_id = ? AND status = 'IN_PROGRESS'
       ORDER BY started_at DESC LIMIT 1`,
      [quizId, user.user_id],
    );

    if (activeAttempts.length > 0) {
      const active = activeAttempts[0];
      const isExpired = active.expires_at && new Date() > new Date(active.expires_at);
      if (!isExpired) {
        // Return active attempt without creating a duplicate
        const remainingSeconds = active.expires_at
          ? Math.max(0, Math.floor((new Date(active.expires_at) - new Date()) / 1000))
          : null;

        let questionSet = active.question_set;
        if (typeof questionSet === "string") {
          try {
            questionSet = JSON.parse(questionSet);
          } catch (e) {
            questionSet = [];
          }
        }
        if (!Array.isArray(questionSet)) {
          questionSet = [];
        }

        return res.status(200).json({
          success: true,
          resumed: true,
          message: "Resuming existing active quiz attempt",
          data: {
            attempt_id: active.attempt_id,
            attempt_number: active.attempt_number,
            started_at: active.started_at,
            expires_at: active.expires_at,
            remaining_seconds: remainingSeconds,
            questions: questionSet,
            question_set: questionSet,
          },
        });
      } else {
        // Mark previous expired attempt as TIMED_OUT
        await pool.query("UPDATE academic_attempts SET status = 'TIMED_OUT' WHERE attempt_id = ?", [active.attempt_id]);
      }
    }

    // Rule 5: Attempt limit check
    const [attemptCountRows] = await pool.query(
      "SELECT COUNT(*) AS total_attempts FROM academic_attempts WHERE quiz_id = ? AND person_id = ?",
      [quizId, user.user_id],
    );

    const attemptNumber = attemptCountRows[0].total_attempts + 1;
    if (quiz.max_attempts && attemptCountRows[0].total_attempts >= quiz.max_attempts) {
      return res.status(403).json({
        success: false,
        code: "MAX_ATTEMPTS_REACHED",
        message: `Maximum allowed attempts (${quiz.max_attempts}) reached for this quiz`,
      });
    }

    // Fetch approved questions
    const [rawQuestions] = await pool.query(
      "SELECT question_id, type, text, options, marks, difficulty FROM academic_questions WHERE topic_id = ? AND status = 'Approved'",
      [quiz.topic_id],
    );

    if (rawQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "This quiz currently has no approved questions available",
      });
    }

    let questionsPool = rawQuestions;

    // Random Question Selection if questions_to_draw is configured (AC-QZ-05)
    if (quiz.questions_to_draw && quiz.questions_to_draw > 0) {
      // Gracefully cap to available questions so smaller question pools do not block quiz attempts
      const countToDraw = Math.min(rawQuestions.length, quiz.questions_to_draw);
      const shuffledBank = shuffleArray(rawQuestions);
      questionsPool = shuffledBank.slice(0, countToDraw);
    }

    // Process & sanitize questions for student snapshot
    let sanitizedQuestions = questionsPool.map((q) => {
      let opts = q.options;
      if (typeof opts === "string") {
        try {
          opts = JSON.parse(opts);
        } catch (e) {
          opts = [];
        }
      }

      if (quiz.shuffle_options && Array.isArray(opts)) {
        opts = shuffleArray(opts);
      }

      return {
        question_id: q.question_id,
        type: q.type,
        text: q.text,
        options: opts,
        marks: parseFloat(q.marks),
        difficulty: q.difficulty,
      };
    });

    if (quiz.shuffle_questions) {
      sanitizedQuestions = shuffleArray(sanitizedQuestions);
    }

    const timeLimitMinutes = quiz.time_limit || 0;
    const expiresAt = timeLimitMinutes > 0
      ? new Date(Date.now() + timeLimitMinutes * 60 * 1000)
      : null;

    const [insertResult] = await pool.query(
      `INSERT INTO academic_attempts
        (quiz_id, person_id, attempt_number, started_at, expires_at, status, question_set)
       VALUES (?, ?, ?, NOW(), ?, 'IN_PROGRESS', ?)`,
      [quizId, user.user_id, attemptNumber, expiresAt, JSON.stringify(sanitizedQuestions)],
    );

    const attemptId = insertResult.insertId;

    await logAcademicEvent({
      personId: user.user_id,
      locationId: `ACAD-QUIZ-${quizId}`,
      eventType: "QUIZ_ATTEMPT_START",
      payload: { attemptId, quizId, attemptNumber, questionCount: sanitizedQuestions.length },
    });

    const remainingSeconds = expiresAt ? Math.floor((expiresAt - Date.now()) / 1000) : null;

    return res.status(201).json({
      success: true,
      message: "Quiz attempt started successfully",
      data: {
        attempt_id: attemptId,
        attempt_number: attemptNumber,
        quiz_id: parseInt(quizId, 10),
        started_at: new Date(),
        expires_at: expiresAt,
        remaining_seconds: remainingSeconds,
        questions: sanitizedQuestions,
      },
    });
  } catch (err) {
    console.error("[AcademicAttempt] startQuizAttempt error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/v1/academic/attempts/:id
 * Resume or view attempt
 */
async function getAttemptById(req, res) {
  try {
    const attemptId = req.params.id;
    const user = req.user;

    const [rows] = await pool.query(
      `SELECT a.*, q.title AS quiz_title, q.time_limit, q.pass_mark, q.show_explanation,
              q.topic_id, t.subject_id, t.title AS topic_title
       FROM academic_attempts a
       JOIN academic_quizzes q ON a.quiz_id = q.quiz_id
       JOIN academic_topics t ON q.topic_id = t.topic_id
       WHERE a.attempt_id = ?`,
      [attemptId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }

    const attempt = rows[0];

    // Ownership check: Student can only view own attempt
    if (user.role === "STUDENT" && attempt.person_id !== user.user_id) {
      return res.status(403).json({ success: false, message: "Access denied to this attempt" });
    }

    // Parse question set
    if (typeof attempt.question_set === "string") {
      try {
        attempt.question_set = JSON.parse(attempt.question_set);
      } catch (e) {
        attempt.question_set = [];
      }
    }
    if (!Array.isArray(attempt.question_set)) {
      attempt.question_set = [];
    }
    attempt.questions = attempt.question_set;

    // Check timer expiration
    if (attempt.status === "IN_PROGRESS" && attempt.expires_at) {
      if (new Date() > new Date(attempt.expires_at)) {
        await pool.query("UPDATE academic_attempts SET status = 'TIMED_OUT' WHERE attempt_id = ?", [attemptId]);
        attempt.status = "TIMED_OUT";
      }
    }

    // Fetch saved answers
    const [answers] = await pool.query(
      "SELECT question_id, answer, is_correct, marks_awarded, answered_at FROM academic_attempt_answers WHERE attempt_id = ?",
      [attemptId],
    );
    attempt.answers = answers;

    const remainingSeconds =
      attempt.status === "IN_PROGRESS" && attempt.expires_at
        ? Math.max(0, Math.floor((new Date(attempt.expires_at) - new Date()) / 1000))
        : 0;

    attempt.remaining_seconds = remainingSeconds;

    return res.status(200).json({ success: true, data: attempt });
  } catch (err) {
    console.error("[AcademicAttempt] getAttemptById error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * PUT /api/v1/academic/attempts/:id/answers
 * Autosave student answer(s) during active attempt
 */
async function autosaveAnswers(req, res) {
  try {
    const attemptId = req.params.id;
    const user = req.user;
    const { answers, question_id, answer } = req.body;

    const [attempts] = await pool.query(
      "SELECT * FROM academic_attempts WHERE attempt_id = ?",
      [attemptId],
    );

    if (attempts.length === 0) {
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }

    const attempt = attempts[0];

    if (attempt.person_id !== user.user_id && user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (attempt.status !== "IN_PROGRESS") {
      return res.status(400).json({
        success: false,
        message: `Cannot save answers. Attempt status is '${attempt.status}'`,
      });
    }

    if (attempt.expires_at && new Date() > new Date(attempt.expires_at)) {
      await pool.query("UPDATE academic_attempts SET status = 'TIMED_OUT' WHERE attempt_id = ?", [attemptId]);
      return res.status(400).json({ success: false, message: "Quiz time has expired" });
    }

    const itemsToSave = [];
    if (Array.isArray(answers)) {
      itemsToSave.push(...answers);
    } else if (question_id !== undefined) {
      itemsToSave.push({ question_id, answer });
    }

    for (const item of itemsToSave) {
      if (item.question_id) {
        await pool.query(
          `INSERT INTO academic_attempt_answers (attempt_id, question_id, answer, answered_at)
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE answer = VALUES(answer), answered_at = NOW()`,
          [attemptId, item.question_id, String(item.answer || "")],
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Answers saved successfully",
      saved_count: itemsToSave.length,
    });
  } catch (err) {
    console.error("[AcademicAttempt] autosaveAnswers error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * POST /api/v1/academic/attempts/:id/submit
 * Finalize quiz attempt, score questions, and calculate pass/fail status idempotently
 */
async function submitQuizAttempt(req, res) {
  const conn = await pool.getConnection();
  try {
    const attemptId = req.params.id;
    const user = req.user;
    const { idempotency_key, answers } = req.body;

    await conn.beginTransaction();

    const [attempts] = await conn.query(
      `SELECT a.*, q.topic_id, q.pass_mark, q.show_explanation, q.quiz_id
       FROM academic_attempts a
       JOIN academic_quizzes q ON a.quiz_id = q.quiz_id
       WHERE a.attempt_id = ? FOR UPDATE`,
      [attemptId],
    );

    if (attempts.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }

    const attempt = attempts[0];

    // Ownership check
    if (user.role === "STUDENT" && attempt.person_id !== user.user_id) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Idempotency: If already submitted, return existing result without re-evaluating
    if (attempt.status === "SUBMITTED") {
      await conn.commit();
      return res.status(200).json({
        success: true,
        already_submitted: true,
        message: "Attempt already submitted",
        data: {
          attempt_id: attempt.attempt_id,
          score: parseFloat(attempt.score),
          max_score: parseFloat(attempt.max_score),
          percentage: parseFloat(attempt.percentage),
          result: attempt.result,
          submitted_at: attempt.submitted_at,
        },
      });
    }

    // Idempotency Key check: if another request already finalized with this key
    if (idempotency_key) {
      const [keyRows] = await conn.query(
        "SELECT * FROM academic_attempts WHERE idempotency_key = ? LIMIT 1",
        [idempotency_key],
      );
      if (keyRows.length > 0) {
        const existingAttempt = keyRows[0];
        await conn.commit();
        return res.status(200).json({
          success: true,
          already_submitted: true,
          message: "Attempt already submitted (idempotent response)",
          data: {
            attempt_id: existingAttempt.attempt_id,
            score: parseFloat(existingAttempt.score || 0),
            max_score: parseFloat(existingAttempt.max_score || 0),
            percentage: parseFloat(existingAttempt.percentage || 0),
            result: existingAttempt.result,
            submitted_at: existingAttempt.submitted_at,
          },
        });
      }
    }

    // If answers provided in submission payload, record them first
    if (Array.isArray(answers)) {
      for (const item of answers) {
        if (item.question_id) {
          await conn.query(
            `INSERT INTO academic_attempt_answers (attempt_id, question_id, answer, answered_at)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE answer = VALUES(answer), answered_at = NOW()`,
            [attemptId, item.question_id, String(item.answer || "")],
          );
        }
      }
    }

    // Parse question set to grade against authoritative questions
    const questionSet = typeof attempt.question_set === "string"
      ? JSON.parse(attempt.question_set)
      : attempt.question_set;

    const questionIds = questionSet.map((q) => q.question_id);

    // Fetch authoritative answer keys from academic_questions
    const [authQuestions] = await conn.query(
      "SELECT question_id, type, answer, marks, explanation FROM academic_questions WHERE question_id IN (?)",
      [questionIds.length > 0 ? questionIds : [0]],
    );

    const authMap = new Map();
    authQuestions.forEach((q) => authMap.set(q.question_id, q));

    // Fetch student's submitted answers
    const [savedAnswers] = await conn.query(
      "SELECT * FROM academic_attempt_answers WHERE attempt_id = ?",
      [attemptId],
    );

    const studentAnswerMap = new Map();
    savedAnswers.forEach((ans) => studentAnswerMap.set(ans.question_id, ans));

    let totalScore = 0;
    let maxPossibleScore = 0;
    const gradedBreakdown = [];

    for (const q of questionSet) {
      const auth = authMap.get(q.question_id);
      const studentAns = studentAnswerMap.get(q.question_id);
      const marksForQ = auth ? parseFloat(auth.marks) : 1.0;
      maxPossibleScore += marksForQ;

      let isCorrect = false;
      let marksAwarded = 0;

      if (auth && studentAns && studentAns.answer) {
        const studentText = String(studentAns.answer).trim().toLowerCase();
        const correctText = String(auth.answer).trim().toLowerCase();

        // Exact match (covers MCQ option ID like 'A' or text, and TrueFalse)
        if (studentText === correctText) {
          isCorrect = true;
          marksAwarded = marksForQ;
          totalScore += marksAwarded;
        } else if (q.options) {
          // If options is an array of objects or strings, resolve key/text equivalence
          let opts = q.options;
          if (typeof opts === "string") {
            try {
              opts = JSON.parse(opts);
            } catch (e) {
              opts = [];
            }
          }
          if (Array.isArray(opts)) {
            for (let i = 0; i < opts.length; i++) {
              const opt = opts[i];
              const defaultKey = String.fromCharCode(65 + i).toLowerCase();
              let optKey = defaultKey;
              let optText = "";
              if (typeof opt === "object" && opt !== null) {
                optKey = String(opt.key || defaultKey).trim().toLowerCase();
                optText = String(opt.text || opt.label || "").trim().toLowerCase();
              } else {
                optText = String(opt ?? "").trim().toLowerCase();
              }

              // Check if one matches key and the other matches text
              if (
                (studentText === optKey && correctText === optText) ||
                (studentText === optText && correctText === optKey)
              ) {
                isCorrect = true;
                marksAwarded = marksForQ;
                totalScore += marksAwarded;
                break;
              }
            }
          }
        }
      }

      // Update attempt answer record
      if (studentAns) {
        await conn.query(
          "UPDATE academic_attempt_answers SET is_correct = ?, marks_awarded = ? WHERE answer_id = ?",
          [isCorrect ? 1 : 0, marksAwarded, studentAns.answer_id],
        );
      } else {
        // Record unattempted question
        await conn.query(
          `INSERT INTO academic_attempt_answers (attempt_id, question_id, answer, is_correct, marks_awarded)
           VALUES (?, ?, NULL, 0, 0)`,
          [attemptId, q.question_id],
        );
      }

      gradedBreakdown.push({
        question_id: q.question_id,
        student_answer: studentAns ? studentAns.answer : null,
        correct_answer: attempt.show_explanation ? (auth ? auth.answer : null) : undefined,
        is_correct: isCorrect,
        marks_awarded: marksAwarded,
        max_marks: marksForQ,
        explanation: attempt.show_explanation ? (auth ? auth.explanation : null) : undefined,
      });
    }

    const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    const passMark = parseFloat(attempt.pass_mark) || 50.0;
    const finalResult = percentage >= passMark ? "PASSED" : "FAILED";

    // Remediation Calculation for Failed Attempts (AC-STU-07)
    let remediation = null;
    if (finalResult === "FAILED") {
      const missedItems = gradedBreakdown.filter((item) => !item.is_correct);
      const missedIds = missedItems.map((q) => q.question_id);

      let recommendedMaterials = [];
      if (missedIds.length > 0) {
        const [missedDetails] = await conn.query(
          "SELECT question_id, text, source_ref, difficulty FROM academic_questions WHERE question_id IN (?)",
          [missedIds],
        );

        const [matRows] = await conn.query(
          `SELECT material_id, topic_id, type, title, description, required_flag
           FROM academic_materials
           WHERE topic_id = ? AND status = 'Published'
           ORDER BY required_flag DESC, position ASC`,
          [attempt.topic_id],
        );

        recommendedMaterials = matRows.map((m) => {
          const isDirectlyMatched = missedDetails.some(
            (md) => md.source_ref && (m.title.toLowerCase().includes(md.source_ref.toLowerCase()) || String(m.material_id) === String(md.source_ref)),
          );
          return {
            material_id: m.material_id,
            title: m.title,
            type: m.type,
            required_flag: m.required_flag === 1,
            directly_recommended: isDirectlyMatched || m.required_flag === 1,
          };
        });
      }

      // Check remaining attempts
      const [attemptCountRows] = await conn.query(
        "SELECT COUNT(*) AS total FROM academic_attempts WHERE quiz_id = ? AND person_id = ? AND status = 'SUBMITTED'",
        [attempt.quiz_id, user.user_id],
      );
      const attemptsCount = (attemptCountRows[0].total || 0) + 1;
      const maxAttempts = attempt.max_attempts || 3;

      remediation = {
        weak_topics: [
          {
            topic_id: attempt.topic_id,
            missed_questions_count: missedItems.length,
            total_questions: questionSet.length,
          },
        ],
        missed_questions_count: missedItems.length,
        recommended_materials: recommendedMaterials,
        retry_allowed: attemptsCount < maxAttempts,
        remaining_attempts: Math.max(0, maxAttempts - attemptsCount),
      };
    }

    await conn.query(
      `UPDATE academic_attempts SET 
        status = 'SUBMITTED',
        submitted_at = NOW(),
        score = ?,
        max_score = ?,
        percentage = ?,
        result = ?,
        idempotency_key = ?
       WHERE attempt_id = ?`,
      [totalScore, maxPossibleScore, percentage.toFixed(2), finalResult, idempotency_key || null, attemptId],
    );

    await conn.commit();

    await logAcademicEvent({
      personId: user.user_id,
      locationId: `ACAD-QUIZ-${attempt.quiz_id}`,
      eventType: "QUIZ_SUBMIT",
      payload: {
        attemptId,
        score: totalScore,
        maxScore: maxPossibleScore,
        percentage: percentage.toFixed(2),
        result: finalResult,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Quiz submitted and evaluated successfully",
      data: {
        attempt_id: parseInt(attemptId, 10),
        score: totalScore,
        max_score: maxPossibleScore,
        percentage: parseFloat(percentage.toFixed(2)),
        pass_mark: passMark,
        result: finalResult,
        breakdown: gradedBreakdown,
        remediation,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error("[AcademicAttempt] submitQuizAttempt error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    conn.release();
  }
}

/**
 * POST /api/v1/academic/attempts/:id/violation
 * Authoritatively records proctoring integrity violations and enforces cancellation on 3rd strike
 */
async function recordAttemptViolation(req, res) {
  const conn = await pool.getConnection();
  try {
    const attemptId = req.params.id;
    const user = req.user;
    const { reason, strike = 3 } = req.body;

    await conn.beginTransaction();

    const [attempts] = await conn.query(
      `SELECT a.*, q.quiz_id, q.title AS quiz_title
       FROM academic_attempts a
       JOIN academic_quizzes q ON a.quiz_id = q.quiz_id
       WHERE a.attempt_id = ? FOR UPDATE`,
      [attemptId],
    );

    if (attempts.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }

    const attempt = attempts[0];

    // Ownership check: Student can only record for own attempt; Faculty/Admin can flag any
    if (user.role === "STUDENT" && attempt.person_id !== user.user_id) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Idempotent cancellation: if already cancelled, return success
    if (attempt.status === "CANCELLED") {
      await conn.commit();
      return res.status(200).json({
        success: true,
        already_cancelled: true,
        message: "Attempt is already marked as cancelled",
        status: "CANCELLED",
      });
    }

    if (attempt.status !== "IN_PROGRESS") {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot record violation. Attempt status is '${attempt.status}'`,
      });
    }

    const violationText = reason || "Focus departure / integrity violation limit reached";

    // Update attempt status to CANCELLED with 0 score
    await conn.query(
      `UPDATE academic_attempts SET
        status = 'CANCELLED',
        score = 0.00,
        percentage = 0.00,
        result = 'FAILED',
        submitted_at = NOW()
       WHERE attempt_id = ?`,
      [attemptId],
    );

    await conn.commit();

    // Log to immutable academic audit ledger
    await logAcademicEvent({
      personId: user.user_id,
      locationId: `ACAD-QUIZ-${attempt.quiz_id}`,
      eventType: "INTEGRITY_VIOLATION",
      reasonCode: "PROCTOR_STRIKE_TERMINATION",
      payload: {
        attemptId: attempt.attempt_id,
        quizId: attempt.quiz_id,
        strike,
        violationReason: violationText,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Attempt sitting terminated for academic integrity review",
      status: "CANCELLED",
      attempt_id: parseInt(attemptId, 10),
    });
  } catch (err) {
    await conn.rollback();
    console.error("[AcademicAttempt] recordAttemptViolation error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    conn.release();
  }
}

/**
 * GET /api/v1/academic/quizzes/:id/my-attempt
 * Retrieves the student's latest submitted or active attempt for a given quiz
 */
async function getMyAttemptResult(req, res) {
  try {
    const quizId = req.params.id;
    const user = req.user;

    const [rows] = await pool.query(
      `SELECT a.*, q.title AS quiz_title, q.time_limit, q.pass_mark, q.show_explanation,
              q.topic_id, t.subject_id, t.title AS topic_title
       FROM academic_attempts a
       JOIN academic_quizzes q ON a.quiz_id = q.quiz_id
       JOIN academic_topics t ON q.topic_id = t.topic_id
       WHERE a.quiz_id = ? AND a.person_id = ?
       ORDER BY a.started_at DESC LIMIT 1`,
      [quizId, user.user_id],
    );

    if (rows.length === 0) {
      return res.status(200).json({ success: true, data: null });
    }

    const attempt = rows[0];

    if (typeof attempt.question_set === "string") {
      try {
        attempt.question_set = JSON.parse(attempt.question_set);
      } catch (e) {}
    }

    const [answers] = await pool.query(
      "SELECT question_id, answer, is_correct, marks_awarded, answered_at FROM academic_attempt_answers WHERE attempt_id = ?",
      [attempt.attempt_id],
    );
    attempt.answers = answers;

    return res.status(200).json({
      success: true,
      data: attempt,
    });
  } catch (err) {
    console.error("[AcademicAttempt] getMyAttemptResult error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

module.exports = {
  getQuizUnlockStatus,
  startQuizAttempt,
  getAttemptById,
  autosaveAnswers,
  submitQuizAttempt,
  recordAttemptViolation,
  getMyAttemptResult,
};

