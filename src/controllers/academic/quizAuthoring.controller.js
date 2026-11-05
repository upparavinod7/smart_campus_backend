const pool = require("../../config/mysql");
const { logAcademicEvent } = require("../../utils/academicLedger");

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
      pass_mark,
      max_attempts,
      open_at,
      close_at,
      status,
      shuffle_questions,
      shuffle_options,
      show_explanation,
    } = req.body;

    const [existing] = await pool.query("SELECT * FROM academic_quizzes WHERE topic_id = ?", [topicId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Quiz not found for this topic" });
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
    if (open_at !== undefined) {
      updates.push("open_at = ?");
      params.push(open_at || null);
    }
    if (close_at !== undefined) {
      updates.push("close_at = ?");
      params.push(close_at || null);
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

    // Normalize options if JSON string
    questions.forEach((q) => {
      if (typeof q.options === "string") {
        try {
          q.options = JSON.parse(q.options);
        } catch (e) {}
      }
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
    const {
      type = "MCQ",
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

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Question text is required" });
    }

    if (!answer || !String(answer).trim()) {
      return res.status(400).json({ success: false, message: "Question correct answer is required" });
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
        String(answer).trim(),
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
        answer: String(answer).trim(),
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
    const { type, text, options, answer, explanation, marks, difficulty, source_ref, status } = req.body;

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
    if (answer !== undefined) {
      updates.push("answer = ?");
      params.push(String(answer).trim());
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

    await pool.query("DELETE FROM academic_questions WHERE question_id = ?", [questionId]);

    await logAcademicEvent({
      personId: req.user.user_id,
      locationId: `ACAD-QUEST-${questionId}`,
      eventType: "QUESTION_DELETED",
      payload: { topicId: existing[0].topic_id },
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
        total_questions: questions.length,
        questions,
      },
    });
  } catch (err) {
    console.error("[AcademicQuiz] previewQuiz error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

module.exports = {
  getTopicQuiz,
  updateTopicQuiz,
  getTopicQuestions,
  createQuestion,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  previewQuiz,
};

