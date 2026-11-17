const express = require("express");
const path = require("path");
const fs = require("fs");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");
const {
  requireAcademicPolicy,
  requireStudentSubjectEnrollment,
} = require("../middleware/academicAuth");
const { parseMultipartFormData } = require("../utils/multipart");

const subjectTopicCtrl = require("../controllers/academic/subjectTopic.controller");
const materialCtrl = require("../controllers/academic/material.controller");
const quizAuthoringCtrl = require("../controllers/academic/quizAuthoring.controller");
const quizAttemptCtrl = require("../controllers/academic/quizAttempt.controller");
const resultsAnalyticsCtrl = require("../controllers/academic/resultsAnalytics.controller");

const router = express.Router();

// OpenAPI Specification Endpoint
router.get("/openapi.json", (req, res) => {
  const specPath = path.resolve(__dirname, "../docs/academicOpenAPI.json");
  if (fs.existsSync(specPath)) {
    return res.sendFile(specPath);
  }
  return res.status(404).json({ success: false, message: "OpenAPI specification not found" });
});

// ==========================================
// 1. Subjects & Topics
// ==========================================
router.get("/subjects", authenticateToken, subjectTopicCtrl.getSubjects);
router.get("/subjects/:id", authenticateToken, subjectTopicCtrl.getSubjectById);
router.post(
  "/subjects/:id/staff",
  authenticateToken,
  requireAcademicPolicy("MANAGE_STAFF"),
  subjectTopicCtrl.assignStaff,
);
router.get("/subjects/:id/staff", authenticateToken, subjectTopicCtrl.getSubjectById);
router.delete(
  "/subjects/:id/staff/:assignmentId",
  authenticateToken,
  requireAcademicPolicy("MANAGE_STAFF"),
  subjectTopicCtrl.removeStaff,
);

router.get("/subjects/:id/topics", authenticateToken, subjectTopicCtrl.getSubjectTopics);
router.post(
  "/subjects/:id/topics",
  authenticateToken,
  requireAcademicPolicy("MANAGE_TOPICS"),
  subjectTopicCtrl.createTopic,
);
router.put(
  "/subjects/:id/topics/reorder",
  authenticateToken,
  requireAcademicPolicy("MANAGE_TOPICS"),
  subjectTopicCtrl.reorderTopics,
);

router.get("/topics/:id", authenticateToken, subjectTopicCtrl.getTopicById);
router.put(
  "/topics/:id",
  authenticateToken,
  requireAcademicPolicy("MANAGE_TOPICS"),
  subjectTopicCtrl.updateTopic,
);
router.delete(
  "/topics/:id",
  authenticateToken,
  requireAcademicPolicy("MANAGE_TOPICS"),
  subjectTopicCtrl.deleteTopic,
);

// ==========================================
// 2. Study Materials
// ==========================================
router.get("/topics/:id/materials", authenticateToken, materialCtrl.getTopicMaterials);
router.post(
  "/topics/:id/materials",
  authenticateToken,
  requireAcademicPolicy("UPLOAD_MATERIALS"),
  parseMultipartFormData(),
  materialCtrl.createMaterial,
);
router.put(
  "/topics/:id/materials/reorder",
  authenticateToken,
  requireAcademicPolicy("UPLOAD_MATERIALS"),
  materialCtrl.reorderMaterials,
);

router.get("/materials/:id", authenticateToken, materialCtrl.getMaterialById);
router.put(
  "/materials/:id",
  authenticateToken,
  requireAcademicPolicy("UPLOAD_MATERIALS"),
  parseMultipartFormData(),
  materialCtrl.updateMaterial,
);
router.post(
  "/materials/:id/publish",
  authenticateToken,
  requireAcademicPolicy("PUBLISH_MATERIALS"),
  materialCtrl.togglePublishMaterial,
);
router.delete(
  "/materials/:id",
  authenticateToken,
  requireAcademicPolicy("UPLOAD_MATERIALS"),
  materialCtrl.deleteMaterial,
);
router.put(
  "/materials/:id/progress",
  authenticateToken,
  materialCtrl.updateMaterialProgress,
);
router.get(
  "/materials/:id/download",
  authenticateToken,
  materialCtrl.downloadMaterial,
);
router.get(
  "/materials/:id/view",
  authenticateToken,
  materialCtrl.downloadMaterial,
);

// ==========================================
// 3. Quiz Authoring & Question Bank
// ==========================================
router.get("/topics/:id/quiz", authenticateToken, quizAuthoringCtrl.getTopicQuiz);
router.put(
  "/topics/:id/quiz",
  authenticateToken,
  requireAcademicPolicy("CONFIGURE_QUIZ"),
  quizAuthoringCtrl.updateTopicQuiz,
);

router.get(
  "/topics/:id/questions",
  authenticateToken,
  requireAcademicPolicy("AUTHOR_QUESTIONS"),
  quizAuthoringCtrl.getTopicQuestions,
);
router.post(
  "/topics/:id/questions",
  authenticateToken,
  requireAcademicPolicy("AUTHOR_QUESTIONS"),
  quizAuthoringCtrl.createQuestion,
);
router.get(
  "/questions/:id",
  authenticateToken,
  requireAcademicPolicy("AUTHOR_QUESTIONS"),
  quizAuthoringCtrl.getQuestionById,
);
router.put(
  "/questions/:id",
  authenticateToken,
  requireAcademicPolicy("AUTHOR_QUESTIONS"),
  quizAuthoringCtrl.updateQuestion,
);
router.delete(
  "/questions/:id",
  authenticateToken,
  requireAcademicPolicy("AUTHOR_QUESTIONS"),
  quizAuthoringCtrl.deleteQuestion,
);
router.get(
  "/topics/:id/quiz/preview",
  authenticateToken,
  requireAcademicPolicy("PREVIEW_QUIZ"),
  quizAuthoringCtrl.previewQuiz,
);

// ==========================================
// 4. Quiz Attempts & Engine
// ==========================================
router.post(
  "/quizzes/:id/attempts",
  authenticateToken,
  requireAcademicPolicy("ATTEMPT_QUIZ"),
  requireStudentSubjectEnrollment(),
  quizAttemptCtrl.startQuizAttempt,
);
router.get("/quizzes/:id/my-attempt", authenticateToken, quizAttemptCtrl.getMyQuizAttempt);
router.get("/attempts/:id", authenticateToken, quizAttemptCtrl.getAttemptById);
router.put("/attempts/:id/answers", authenticateToken, quizAttemptCtrl.autosaveAnswers);
router.post("/attempts/:id/submit", authenticateToken, quizAttemptCtrl.submitQuizAttempt);
router.post("/attempts/:id/violation", authenticateToken, quizAttemptCtrl.reportQuizViolation);

// ==========================================
// 5. Results & Analytics
// ==========================================
router.get(
  "/subjects/:id/results",
  authenticateToken,
  requireAcademicPolicy("VIEW_ANALYTICS"),
  resultsAnalyticsCtrl.getSubjectResults,
);
router.get(
  "/subjects/:id/results/export",
  authenticateToken,
  requireAcademicPolicy("VIEW_ANALYTICS"),
  resultsAnalyticsCtrl.exportSubjectResultsCsv,
);
router.get("/me/progress", authenticateToken, resultsAnalyticsCtrl.getMyAcademicProgress);
router.post(
  "/attempts/:id/score-correction",
  authenticateToken,
  requireAcademicPolicy("CORRECT_SCORE"),
  resultsAnalyticsCtrl.correctAttemptScore,
);

// ==========================================
// 6. Admin Academic Oversight
// ==========================================
router.get(
  "/admin/oversight",
  authenticateToken,
  authorizeRoles("ADMIN"),
  resultsAnalyticsCtrl.getAdminAcademicOversight,
);

// ==========================================
// 7. Policy Matrix
// ==========================================
router.get("/permissions", authenticateToken, resultsAnalyticsCtrl.getPermissionsMatrix);
router.put(
  "/permissions/:action",
  authenticateToken,
  authorizeRoles("ADMIN"),
  resultsAnalyticsCtrl.updatePermissionPolicy,
);

module.exports = router;
