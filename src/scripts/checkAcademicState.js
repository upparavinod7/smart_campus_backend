const pool = require("../config/mysql");

async function check() {
  try {
    const [topics] = await pool.query("SELECT * FROM academic_topics");
    console.log("TOPICS:", topics.length, JSON.stringify(topics.slice(0, 3), null, 2));

    const [mats] = await pool.query("SELECT * FROM academic_materials");
    console.log("MATS:", mats.length, JSON.stringify(mats.slice(0, 3), null, 2));

    const [quizzes] = await pool.query("SELECT * FROM academic_quizzes");
    console.log("QUIZZES:", quizzes.length, JSON.stringify(quizzes.slice(0, 3), null, 2));

    const [questions] = await pool.query("SELECT * FROM academic_questions");
    console.log("QUESTIONS:", questions.length);

    const [attempts] = await pool.query("SELECT * FROM academic_attempts");
    console.log("ATTEMPTS:", attempts.length);

    const [progress] = await pool.query("SELECT * FROM academic_material_progress");
    console.log("PROGRESS:", progress.length, JSON.stringify(progress, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  }
}

check();
