/**
 * Comprehensive SOCI Academic Curriculum Definition, Batch Mapping, Faculty Allocation & Timetable Schedule
 */

const SEMESTER_CURRICULUM = {
  1: {
    year_no: 1,
    term_type: "ODD",
    subjects: [
      { code: "23BTAM111", name: "Fundamentals of Computing", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM112", name: "Fundamentals of Computing Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "23BTAM113", name: "Introduction to Programming", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM114", name: "Introduction to Programming Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "23BTAM115", name: "Mathematics I", type: "THEORY", credits: 4.0, weekly_sessions: 4 },
      { code: "23BTAM116", name: "Physics I", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM117", name: "English for Communication", type: "THEORY", credits: 2.0, weekly_sessions: 2 },
    ],
  },
  2: {
    year_no: 1,
    term_type: "EVEN",
    subjects: [
      { code: "23BTAM121", name: "Python Programming", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM122", name: "Python Programming Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "23BTAM123", name: "Mathematics II", type: "THEORY", credits: 4.0, weekly_sessions: 4 },
      { code: "23BTAM124", name: "Physics II", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM125", name: "English for Development", type: "THEORY", credits: 2.0, weekly_sessions: 2 },
      { code: "23BTAM126", name: "Discrete Mathematics", type: "THEORY", credits: 4.0, weekly_sessions: 4 },
    ],
  },
  3: {
    year_no: 2,
    term_type: "ODD",
    subjects: [
      { code: "AIML203", name: "Artificial Intelligence", type: "THEORY", credits: 4.0, weekly_sessions: 4 },
      { code: "23BTAM231", name: "Signals & Systems", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM232", name: "Digital Design", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM233", name: "Digital Design Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "AIML103", name: "DSA", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM234", name: "DSA Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "AIML105", name: "Object-Oriented Programming", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM235", name: "OOP Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "BTAM2332", name: "Professional Ethics", type: "THEORY", credits: 2.0, weekly_sessions: 2 },
    ],
  },
  4: {
    year_no: 2,
    term_type: "EVEN",
    subjects: [
      { code: "AIML202", name: "Machine Learning", type: "THEORY", credits: 4.0, weekly_sessions: 4 },
      { code: "AIML206", name: "Machine Learning Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "AIML104", name: "Database Management Systems", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM241", name: "DBMS Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "23BTAM242", name: "Design and Analysis of Algorithms", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM243", name: "DAA Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "23BTAM244", name: "Computer Organization", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "AIML204", name: "Operating Systems", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM245", name: "Engineering Economics", type: "THEORY", credits: 2.0, weekly_sessions: 2 },
    ],
  },
  5: {
    year_no: 3,
    term_type: "ODD",
    subjects: [
      { code: "23BTAM351", name: "Deep Learning", type: "THEORY", credits: 4.0, weekly_sessions: 4 },
      { code: "23BTAM352", name: "Deep Learning Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "AIML205", name: "Computer Networks", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM353", name: "Computer Networks Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "23BTAM354", name: "Computer Architecture", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM355", name: "Software Engineering", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM356", name: "Java Programming", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM357", name: "Java Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "23BTAM358", name: "Theory of Computation", type: "THEORY", credits: 4.0, weekly_sessions: 4 },
      { code: "23BTAM359", name: "AR/VR", type: "THEORY", credits: 2.0, weekly_sessions: 2 },
      { code: "23BTAM360", name: "AR/VR Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
    ],
  },
  6: {
    year_no: 3,
    term_type: "EVEN",
    subjects: [
      { code: "23BTAM361", name: "Predictive Analytics", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM362", name: "Predictive Analytics Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "23BTAM363", name: "Compiler Design", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM364", name: "Compiler Design Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "23BTAM365", name: "Project Management", type: "THEORY", credits: 2.0, weekly_sessions: 2 },
      { code: "23BTAM366", name: "Cryptography & Network Security", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM367", name: "Data Visualization", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
    ],
  },
  7: {
    year_no: 4,
    term_type: "ODD",
    subjects: [
      { code: "23BTAM471", name: "High Performance Computing", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM472", name: "HPC Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "23BTAM473", name: "AI Ethics", type: "THEORY", credits: 2.0, weekly_sessions: 2 },
      { code: "23BTAM474", name: "Web Technology", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM475", name: "Web Technology Lab", type: "LAB", credits: 1.0, weekly_sessions: 1, consecutive: 2 },
      { code: "23BTAM476", name: "Cognitive Psychology", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM477", name: "Pattern Recognition", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
      { code: "23BTAM478", name: "Digital Marketing", type: "THEORY", credits: 2.0, weekly_sessions: 2 },
    ],
  },
  8: {
    year_no: 4,
    term_type: "EVEN",
    subjects: [
      { code: "23BTAM481", name: "Project", type: "PROJECT", credits: 10.0, weekly_sessions: 4, consecutive: 2 },
      { code: "23BTAM482", name: "Data Mining", type: "THEORY", credits: 3.0, weekly_sessions: 3 },
    ],
  },
};

// Batch mapping for 4 years:
// Current Academic Year is 2026-27 (start_year_id: 4)
// Year 1: Batch 2026-30 (Start Year ID: 4, 2026-27), Sections: A, B
// Year 2: Batch 2025-29 (Start Year ID: 3, 2025-26), Sections: A, B
// Year 3: Batch 2024-28 (Start Year ID: 2, 2024-25), Sections: A, B
// Year 4: Batch 2023-27 (Start Year ID: 1, 2023-24), Section: A
const BATCH_SECTION_STRUCTURE = [
  { year: 1, start_year_id: 4, label: "2026-30", odd_sem: 1, even_sem: 2, sections: ["A", "B"] },
  { year: 2, start_year_id: 3, label: "2025-29", odd_sem: 3, even_sem: 4, sections: ["A", "B"] },
  { year: 3, start_year_id: 2, label: "2024-28", odd_sem: 5, even_sem: 6, sections: ["A", "B"] },
  { year: 4, start_year_id: 1, label: "2023-27", odd_sem: 7, even_sem: 8, sections: ["A"] },
];

module.exports = {
  SEMESTER_CURRICULUM,
  BATCH_SECTION_STRUCTURE,
};
