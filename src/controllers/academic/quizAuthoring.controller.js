const pool = require("../../config/mysql");
const { logAcademicEvent } = require("../../utils/academicLedger");
const { isFacultyAuthorizedForSubject } = require("../../middleware/academicAuth");

/**
 * GET /api/v1/academic/topics/:id/quiz
 */
async function getTopicQuiz(req, res) {
  try {
    const topicId = req.params.id;

    const [rows] = await pool.query(
      `SELECT q.*, t.title AS topic_title, t.subject_id, t.quiz_enabled AS topic_quiz_enabled
       FROM academic_quizzes q
       JOIN academic_topics t ON q.topic_id = t.topic_id
       WHERE q.topic_id = ?`,
      [topicId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Quiz not found for this topic" });
    }

    const quiz = rows[0];

    const [qStats] = await pool.query(
      `SELECT 
        COUNT(*) AS total_questions,
        COUNT(CASE WHEN status = 'Approved' THEN 1 END) AS approved_questions,
        COALESCE(SUM(CASE WHEN status = 'Approved' THEN marks ELSE 0 END), 0) AS total_marks
       FROM academic_questions
       WHERE topic_id = ?`,
      [topicId],
    );

    quiz.total_questions = qStats[0].total_questions;
    quiz.approved_questions = qStats[0].approved_questions;
    quiz.total_marks = parseFloat(qStats[0].total_marks);

    return res.status(200).json({ success: true, data: quiz });
  } catch (err) {
    console.error("[AcademicQuiz] getTopicQuiz error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

function formatMySqlDatetime(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * POST /api/v1/academic/topics/:id/quiz
 */
async function createTopicQuiz(req, res) {
  try {
    const topicId = req.params.id;
    const user = req.user;
    const {
      title,
      description,
      time_limit,
      duration_minutes,
      pass_mark,
      pass_percentage,
      max_attempts,
      questions_to_draw,
      open_at,
      close_at,
      available_from,
      due_date,
      start_datetime,
      end_datetime,
      status,
      shuffle_questions,
      shuffle_options,
      show_explanation,
    } = req.body;

    const [topicRows] = await pool.query("SELECT * FROM academic_topics WHERE topic_id = ?", [topicId]);
    if (topicRows.length === 0) {
      return res.status(404).json({ success: false, message: "Course unit (Topic) not found" });
    }

    const quizTitle = title ? title.trim() : `${topicRows[0].title.trim()} Quiz`;
    const openTime = formatMySqlDatetime(open_at || available_from || start_datetime);
    const closeTime = formatMySqlDatetime(close_at || due_date || end_datetime);
    const resolvedTimeLimit = time_limit !== undefined ? time_limit : duration_minutes;
    const resolvedPassMark = pass_mark !== undefined ? pass_mark : pass_percentage;

    const [result] = await pool.query(
      `INSERT INTO academic_quizzes (
        topic_id, title, description, time_limit, pass_mark, max_attempts,
        questions_to_draw, open_at, close_at, status, shuffle_questions,
        shuffle_options, show_explanation, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        description = VALUES(description),
        time_limit = VALUES(time_limit),
        pass_mark = VALUES(pass_mark),
        max_attempts = VALUES(max_attempts),
        questions_to_draw = VALUES(questions_to_draw),
        open_at = VALUES(open_at),
        close_at = VALUES(close_at),
        status = VALUES(status),
        shuffle_questions = VALUES(shuffle_questions),
        shuffle_options = VALUES(shuffle_options),
        show_explanation = VALUES(show_explanation),
        updated_at = NOW()`,
      [
        topicId,
        quizTitle,
        description || null,
        resolvedTimeLimit !== undefined ? Math.max(0, parseInt(resolvedTimeLimit, 10)) : 30,
        resolvedPassMark !== undefined ? parseFloat(resolvedPassMark) : 50,
        max_attempts !== undefined ? Math.max(1, parseInt(max_attempts, 10)) : 3,
        questions_to_draw !== undefined && questions_to_draw !== null && questions_to_draw !== "" ? Math.max(1, parseInt(questions_to_draw, 10)) : null,
        openTime,
        closeTime,
        status || "Draft",
        shuffle_questions ? 1 : 0,
        shuffle_options ? 1 : 0,
        show_explanation ? 1 : 0,
        user.user_id,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Quiz created successfully for course unit",
      data: { quiz_id: result.insertId || result.insertId, topic_id: Number(topicId) },
    });
  } catch (err) {
    console.error("[AcademicQuiz] createTopicQuiz error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * PUT /api/v1/academic/topics/:id/quiz
 */
async function updateTopicQuiz(req, res) {
  try {
    const topicId = req.params.id;
    const user = req.user;
    const {
      title,
      description,
      time_limit,
      duration_minutes,
      pass_mark,
      pass_percentage,
      max_attempts,
      questions_to_draw,
      open_at,
      close_at,
      available_from,
      due_date,
      start_datetime,
      end_datetime,
      status,
      shuffle_questions,
      shuffle_options,
      show_explanation,
    } = req.body;

    const resolvedTimeLimit = time_limit !== undefined ? time_limit : duration_minutes;
    const resolvedPassMark = pass_mark !== undefined ? pass_mark : pass_percentage;
    const openTime = formatMySqlDatetime(open_at || available_from || start_datetime);
    const closeTime = formatMySqlDatetime(close_at || due_date || end_datetime);

    const [existing] = await pool.query("SELECT * FROM academic_quizzes WHERE topic_id = ?", [topicId]);
    if (existing.length === 0) {
      // Upsert/create if missing
      const [topicRows] = await pool.query("SELECT * FROM academic_topics WHERE topic_id = ?", [topicId]);
      if (topicRows.length === 0) {
        return res.status(404).json({ success: false, message: "Quiz and Topic not found" });
      }
      const quizTitle = title ? title.trim() : `${topicRows[0].title.trim()} Quiz`;
      const [ins] = await pool.query(
        `INSERT INTO academic_quizzes (
          topic_id, title, description, time_limit, pass_mark, max_attempts,
          questions_to_draw, open_at, close_at, status, shuffle_questions,
          shuffle_options, show_explanation, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          topicId,
          quizTitle,
          description || null,
          resolvedTimeLimit !== undefined ? Math.max(0, parseInt(resolvedTimeLimit, 10)) : 30,
          resolvedPassMark !== undefined ? parseFloat(resolvedPassMark) : 50,
          max_attempts !== undefined ? Math.max(1, parseInt(max_attempts, 10)) : 3,
          questions_to_draw !== undefined && questions_to_draw !== null && questions_to_draw !== "" ? Math.max(1, parseInt(questions_to_draw, 10)) : null,
          openTime,
          closeTime,
          status || "Draft",
          shuffle_questions ? 1 : 0,
          shuffle_options ? 1 : 0,
          show_explanation ? 1 : 0,
          user.user_id,
        ]
      );
      return res.status(201).json({
        success: true,
        message: "Quiz created successfully",
        data: { quiz_id: ins.insertId, topic_id: Number(topicId) },
      });
    }

    const currentQuiz = existing[0];
    let newVersion = currentQuiz.version;

    // If publishing, ensure there is at least one approved question
    if (status === "Published") {
      const [approvedCount] = await pool.query(
        "SELECT COUNT(*) AS count FROM academic_questions WHERE topic_id = ? AND status = 'Approved'",
        [topicId],
      );
      if (approvedCount[0].count === 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot publish quiz with 0 approved questions in the question bank",
        });
      }
      if (currentQuiz.status === "Published") {
        newVersion += 1;
      }
    }

    const updates = ["version = ?"];
    const params = [newVersion];

    if (title !== undefined) {
      updates.push("title = ?");
      params.push(title.trim());
    }
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }
    if (time_limit !== undefined) {
      updates.push("time_limit = ?");
      params.push(Math.max(0, parseInt(time_limit, 10)));
    }
    if (pass_mark !== undefined) {
      updates.push("pass_mark = ?");
      params.push(parseFloat(pass_mark));
    }
    if (max_attempts !== undefined) {
      updates.push("max_attempts = ?");
      params.push(Math.max(1, parseInt(max_attempts, 10)));
    }
    if (questions_to_draw !== undefined) {
      updates.push("questions_to_draw = ?");
      params.push(questions_to_draw === null || questions_to_draw === "" ? null : Math.max(1, parseInt(questions_to_draw, 10)));
    }
    const openVal = open_at !== undefined ? open_at : available_from;
    if (openVal !== undefined) {
      updates.push("open_at = ?");
      params.push(formatMySqlDatetime(openVal));
    }
    const closeVal = close_at !== undefined ? close_at : due_date;
    if (closeVal !== undefined) {
      updates.push("close_at = ?");
      params.push(formatMySqlDatetime(closeVal));
    }
    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }
    if (shuffle_questions !== undefined) {
      updates.push("shuffle_questions = ?");
      params.push(shuffle_questions ? 1 : 0);
    }
    if (shuffle_options !== undefined) {
      updates.push("shuffle_options = ?");
      params.push(shuffle_options ? 1 : 0);
    }
    if (show_explanation !== undefined) {
      updates.push("show_explanation = ?");
      params.push(show_explanation ? 1 : 0);
    }

    params.push(topicId);
    await pool.query(`UPDATE academic_quizzes SET ${updates.join(", ")}, updated_at = NOW() WHERE topic_id = ?`, params);

    await logAcademicEvent({
      personId: user.user_id,
      locationId: `ACAD-QUIZ-${currentQuiz.quiz_id}`,
      eventType: status === "Published" ? "QUIZ_PUBLISHED" : "QUIZ_CONFIGURED",
      payload: { topicId, quiz_id: currentQuiz.quiz_id, updates: req.body, version: newVersion },
    });

    return res.status(200).json({
      success: true,
      message: "Quiz configuration updated successfully",
      version: newVersion,
    });
  } catch (err) {
    console.error("[AcademicQuiz] updateTopicQuiz error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/v1/academic/topics/:id/questions
 */
async function getTopicQuestions(req, res) {
  try {
    const topicId = req.params.id;
    const { status, difficulty, type } = req.query;

    let sql = "SELECT * FROM academic_questions WHERE topic_id = ?";
    const params = [topicId];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }
    if (difficulty) {
      sql += " AND difficulty = ?";
      params.push(difficulty);
    }
    if (type) {
      sql += " AND type = ?";
      params.push(type);
    }

    sql += " ORDER BY question_id ASC";

    const [questions] = await pool.query(sql, params);

    // Normalize options if JSON string and provide aliases
    questions.forEach((q) => {
      if (typeof q.options === "string") {
        try {
          q.options = JSON.parse(q.options);
        } catch (e) {}
      }
      q.correct_answer = q.answer;
      q.correct_option = q.answer;
    });

    return res.status(200).json({
      success: true,
      count: questions.length,
      data: questions,
    });
  } catch (err) {
    console.error("[AcademicQuiz] getTopicQuestions error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * POST /api/v1/academic/topics/:id/questions
 */
async function createQuestion(req, res) {
  try {
    const topicId = req.params.id;
    const user = req.user;
    const rawType = req.body.type || "MCQ";
    let type = "MCQ";
    if (rawType === "TrueFalse" || rawType === "True/False") {
      type = "TrueFalse";
    } else if (rawType === "ShortAnswer" || rawType === "Short Answer") {
      type = "ShortAnswer";
    }

    const {
      text,
      options,
      answer,
      explanation,
      marks = 1.0,
      difficulty = "Medium",
      source_ref,
      origin = "Manual",
      status = "Approved",
    } = req.body;

    let resolvedAnswer =
      answer !== undefined && String(answer).trim() !== ""
        ? String(answer).trim()
        : req.body.correct_answer !== undefined && String(req.body.correct_answer).trim() !== ""
        ? String(req.body.correct_answer).trim()
        : req.body.correct_option !== undefined && String(req.body.correct_option).trim() !== ""
        ? String(req.body.correct_option).trim()
        : null;

    if (type === "TrueFalse" && resolvedAnswer) {
      if (/^true$/i.test(resolvedAnswer) || resolvedAnswer === "1") {
        resolvedAnswer = "True";
      } else if (/^false$/i.test(resolvedAnswer) || resolvedAnswer === "0") {
        resolvedAnswer = "False";
      }
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Question text is required" });
    }

    if (!resolvedAnswer) {
      return res.status(400).json({ success: false, message: "Question correct answer is required. Please select or provide the correct answer." });
    }

    let parsedOptions = options;
    if (typeof options === "string") {
      try {
        parsedOptions = JSON.parse(options);
      } catch (e) {
        parsedOptions = null;
      }
    }

    if (type === "MCQ") {
      if (!Array.isArray(parsedOptions) || parsedOptions.length < 2) {
        return res.status(400).json({
          success: false,
          message: "MCQ questions require at least 2 options in an array",
        });
      }
    } else if (type === "TrueFalse") {
      parsedOptions = ["True", "False"];
    } else if (type === "ShortAnswer") {
      parsedOptions = [];
    }

    const [result] = await pool.query(
      `INSERT INTO academic_questions
        (topic_id, type, text, options, answer, explanation, marks, difficulty, source_ref, origin, approved_by, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        topicId,
        type,
        text.trim(),
        parsedOptions ? JSON.stringify(parsedOptions) : null,
        String(resolvedAnswer).trim(),
        explanation || null,
        parseFloat(marks) || 1.0,
        difficulty,
        source_ref || null,
        origin === "ML" ? "ML" : "Manual",
        status === "Approved" ? user.user_id : null,
        status,
        user.user_id,
      ],
    );

    const questionId = result.insertId;

    await logAcademicEvent({
      personId: user.user_id,
      locationId: `ACAD-TOPIC-${topicId}`,
      eventType: "QUESTION_CREATED",
      payload: { questionId, type, difficulty, marks },
    });

    return res.status(201).json({
      success: true,
      message: "Question added to question bank",
      data: {
        question_id: questionId,
        topic_id: parseInt(topicId, 10),
        type,
        text: text.trim(),
        options: parsedOptions,
        answer: String(resolvedAnswer).trim(),
        correct_answer: String(resolvedAnswer).trim(),
        explanation,
        marks: parseFloat(marks) || 1.0,
        difficulty,
        status,
      },
    });
  } catch (err) {
    console.error("[AcademicQuiz] createQuestion error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/v1/academic/questions/:id
 */
async function getQuestionById(req, res) {
  try {
    const questionId = req.params.id;

    const [rows] = await pool.query("SELECT * FROM academic_questions WHERE question_id = ?", [questionId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    const question = rows[0];
    if (typeof question.options === "string") {
      try {
        question.options = JSON.parse(question.options);
      } catch (e) {}
    }

    return res.status(200).json({ success: true, data: question });
  } catch (err) {
    console.error("[AcademicQuiz] getQuestionById error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * PUT /api/v1/academic/questions/:id
 */
async function updateQuestion(req, res) {
  try {
    const questionId = req.params.id;
    const user = req.user;
    const { type: rawType, text, options, answer, explanation, marks, difficulty, source_ref, status } = req.body;
    let type = rawType;
    if (type !== undefined) {
      if (type === "TrueFalse" || type === "True/False") type = "TrueFalse";
      else if (type === "ShortAnswer" || type === "Short Answer") type = "ShortAnswer";
      else type = "MCQ";
    }

    let resolvedAnswer =
      answer !== undefined
        ? answer
        : req.body.correct_answer !== undefined
        ? req.body.correct_answer
        : req.body.correct_option;

    if (type === "TrueFalse" && resolvedAnswer !== undefined) {
      const s = String(resolvedAnswer).trim();
      if (/^true$/i.test(s) || s === "1") resolvedAnswer = "True";
      else if (/^false$/i.test(s) || s === "0") resolvedAnswer = "False";
    }

    const [existing] = await pool.query("SELECT * FROM academic_questions WHERE question_id = ?", [questionId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    const updates = [];
    const params = [];

    if (type !== undefined) {
      updates.push("type = ?");
      params.push(type);
    }
    if (text !== undefined) {
      updates.push("text = ?");
      params.push(text.trim());
    }
    if (options !== undefined) {
      const parsed = typeof options === "string" ? options : JSON.stringify(options);
      updates.push("options = ?");
      params.push(parsed);
    }
    if (resolvedAnswer !== undefined) {
      updates.push("answer = ?");
      params.push(String(resolvedAnswer).trim());
    }
    if (explanation !== undefined) {
      updates.push("explanation = ?");
      params.push(explanation);
    }
    if (marks !== undefined) {
      updates.push("marks = ?");
      params.push(parseFloat(marks));
    }
    if (difficulty !== undefined) {
      updates.push("difficulty = ?");
      params.push(difficulty);
    }
    if (source_ref !== undefined) {
      updates.push("source_ref = ?");
      params.push(source_ref);
    }
    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
      if (status === "Approved") {
        updates.push("approved_by = ?");
        params.push(user.user_id);
      }
    }

    if (updates.length > 0) {
      params.push(questionId);
      await pool.query(`UPDATE academic_questions SET ${updates.join(", ")}, updated_at = NOW() WHERE question_id = ?`, params);
    }

    await logAcademicEvent({
      personId: user.user_id,
      locationId: `ACAD-QUEST-${questionId}`,
      eventType: "QUESTION_UPDATED",
      payload: req.body,
    });

    return res.status(200).json({ success: true, message: "Question updated successfully" });
  } catch (err) {
    console.error("[AcademicQuiz] updateQuestion error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * DELETE /api/v1/academic/questions/:id
 */
async function deleteQuestion(req, res) {
  try {
    const questionId = req.params.id;

    const [existing] = await pool.query("SELECT * FROM academic_questions WHERE question_id = ?", [questionId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    const q = existing[0];

    // Check if question is referenced by historical student attempts
    const [referenced] = await pool.query(
      "SELECT 1 FROM academic_attempt_answers WHERE question_id = ? LIMIT 1",
      [questionId],
    );

    if (referenced.length > 0) {
      // Question has historical attempt answers: soft-archive it to protect attempt history
      await pool.query(
        "UPDATE academic_questions SET status = 'Archived', updated_at = NOW() WHERE question_id = ?",
        [questionId],
      );

      await logAcademicEvent({
        personId: req.user.user_id,
        locationId: `ACAD-QUEST-${questionId}`,
        eventType: "QUESTION_ARCHIVED",
        reasonCode: "HISTORICAL_ATTEMPT_PROTECTION",
        payload: {
          questionId,
          topicId: q.topic_id,
          reason: "Question referenced by student attempts; soft-archived to protect historical records",
        },
      });

      return res.status(200).json({
        success: true,
        archived: true,
        message: "Question is referenced by historical student attempts. It has been archived and removed from future quizzes to preserve historical records.",
      });
    }

    // If not referenced by any attempts, physical delete is safe
    await pool.query("DELETE FROM academic_questions WHERE question_id = ?", [questionId]);

    await logAcademicEvent({
      personId: req.user.user_id,
      locationId: `ACAD-QUEST-${questionId}`,
      eventType: "QUESTION_DELETED",
      payload: { topicId: q.topic_id },
    });

    return res.status(200).json({ success: true, message: "Question deleted successfully" });
  } catch (err) {
    console.error("[AcademicQuiz] deleteQuestion error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/v1/academic/topics/:id/quiz/preview
 * Staff preview showing the quiz presentation exactly as served to students
 */
async function previewQuiz(req, res) {
  try {
    const topicId = req.params.id;

    const [quizzes] = await pool.query("SELECT * FROM academic_quizzes WHERE topic_id = ?", [topicId]);
    if (quizzes.length === 0) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    const quiz = quizzes[0];
    const [questions] = await pool.query(
      "SELECT question_id, type, text, options, marks, difficulty FROM academic_questions WHERE topic_id = ? AND status = 'Approved'",
      [topicId],
    );

    questions.forEach((q) => {
      if (typeof q.options === "string") {
        try {
          q.options = JSON.parse(q.options);
        } catch (e) {}
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        quiz_id: quiz.quiz_id,
        title: quiz.title,
        description: quiz.description,
        time_limit: quiz.time_limit,
        pass_mark: quiz.pass_mark,
        max_attempts: quiz.max_attempts,
        questions_to_draw: quiz.questions_to_draw,
        total_questions: questions.length,
        questions,
      },
    });
  } catch (err) {
    console.error("[AcademicQuiz] previewQuiz error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * POST /api/v1/academic/topics/:id/questions/generate
 * Initiates an async ML question generation job
 */
async function generateQuestionsJob(req, res) {
  try {
    const topicId = req.params.id;
    const user = req.user;
    const {
      material_id = null,
      count = 5,
      difficulty_mix = { easy: 2, medium: 2, hard: 1 },
      question_types = ["MCQ", "TrueFalse"],
    } = req.body;

    // 1. Verify topic exists and get subject details
    const [topicRows] = await pool.query(
      `SELECT t.topic_id, t.title AS topic_title, t.subject_id, s.subject_code, s.name AS subject_name, s.ml_enabled
       FROM academic_topics t
       JOIN subjects s ON t.subject_id = s.subject_id
       WHERE t.topic_id = ?`,
      [topicId],
    );

    if (topicRows.length === 0) {
      return res.status(404).json({ success: false, message: "Topic not found" });
    }

    const topic = topicRows[0];

    // 2. Verify subject-level ML feature flag (AC-ROL-02)
    if (!topic.ml_enabled) {
      return res.status(403).json({
        success: false,
        code: "ML_DISABLED_FOR_SUBJECT",
        message: `ML-assisted features are currently disabled for subject '${topic.subject_code}' (${topic.subject_name}).`,
      });
    }

    // 3. Verify material_id if specified belongs to this topic
    if (material_id) {
      const [matRows] = await pool.query(
        "SELECT material_id FROM academic_materials WHERE material_id = ? AND topic_id = ?",
        [material_id, topicId],
      );
      if (matRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Specified material_id ${material_id} does not belong to topic ${topicId}`,
        });
      }
    }

    // 4. Create record in academic_ml_jobs
    const jobConfig = {
      count: Math.min(20, Math.max(1, parseInt(count, 10) || 5)),
      difficulty_mix,
      question_types,
      topic_title: topic.topic_title,
      requested_at: new Date().toISOString(),
    };

    const [result] = await pool.query(
      `INSERT INTO academic_ml_jobs
        (topic_id, material_id, job_type, status, requested_by, result_summary)
       VALUES (?, ?, 'QUESTION_GENERATION', 'PENDING', ?, ?)`,
      [topicId, material_id, user.user_id, JSON.stringify(jobConfig)],
    );

    const jobId = result.insertId;

    await logAcademicEvent({
      personId: user.user_id,
      actorRole: user.role,
      actorUsername: user.username,
      locationId: `ACAD-TOPIC-${topicId}`,
      eventType: "ML_JOB_QUEUED",
      payload: { jobId, topicId, count: jobConfig.count, material_id },
    });

    return res.status(202).json({
      success: true,
      message: "ML question generation job queued successfully",
      data: {
        job_id: jobId,
        topic_id: parseInt(topicId, 10),
        subject_id: topic.subject_id,
        material_id: material_id ? parseInt(material_id, 10) : null,
        job_type: "QUESTION_GENERATION",
        status: "PENDING",
        created_at: new Date(),
        config: jobConfig,
      },
    });
  } catch (err) {
    console.error("[AcademicQuiz] generateQuestionsJob error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/v1/academic/jobs/:id
 * Polls status and draft questions for an ML job
 */
async function getJobStatus(req, res) {
  try {
    const jobId = req.params.id;
    const user = req.user;

    const [rows] = await pool.query(
      `SELECT j.*, t.subject_id, t.title AS topic_title, s.subject_code, u.username AS requester_username
       FROM academic_ml_jobs j
       JOIN academic_topics t ON j.topic_id = t.topic_id
       JOIN subjects s ON t.subject_id = s.subject_id
       JOIN users u ON j.requested_by = u.user_id
       WHERE j.job_id = ?`,
      [jobId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const job = rows[0];

    // Authorization: User must be admin or the faculty who requested it, or assigned to the subject
    if (user.role !== "ADMIN" && job.requested_by !== user.user_id) {
      const isAuthorized = await isFacultyAuthorizedForSubject(user.faculty_id, job.subject_id);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: "Access denied to this job" });
      }
    }

    if (typeof job.result_summary === "string") {
      try {
        job.result_summary = JSON.parse(job.result_summary);
      } catch (e) {}
    }

    // Fetch any draft questions produced by or linked to this job's topic
    const [draftQuestions] = await pool.query(
      `SELECT question_id, topic_id, type, text, options, marks, difficulty, source_ref, origin, status, created_at
       FROM academic_questions
       WHERE topic_id = ? AND origin = 'ML' AND status = 'Draft'
       ORDER BY question_id ASC`,
      [job.topic_id],
    );

    draftQuestions.forEach((q) => {
      if (typeof q.options === "string") {
        try {
          q.options = JSON.parse(q.options);
        } catch (e) {}
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        job_id: job.job_id,
        topic_id: job.topic_id,
        topic_title: job.topic_title,
        subject_id: job.subject_id,
        subject_code: job.subject_code,
        job_type: job.job_type,
        status: job.status,
        requested_by: job.requested_by,
        requester_username: job.requester_username,
        result_summary: job.result_summary,
        created_at: job.created_at,
        updated_at: job.updated_at,
        draft_questions_count: draftQuestions.length,
        draft_questions: draftQuestions,
      },
    });
  } catch (err) {
    console.error("[AcademicQuiz] getJobStatus error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

module.exports = {
  getTopicQuiz,
  createTopicQuiz,
  updateTopicQuiz,
  getTopicQuestions,
  createQuestion,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  previewQuiz,
  generateQuestionsJob,
  getJobStatus,
};

