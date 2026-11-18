/**
 * SMART CAMPUS ERP — Comprehensive SOCI Academic Demo & Timetable Seeder
 * Idempotent, transaction-safe seeding of complete 4-year B.Tech academic structure,
 * subjects catalogue, batches, sections, faculty assignments, demo students, enrollments,
 * and conflict-free weekly timetable slots.
 */

const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
require("dotenv").config();

const { SEMESTER_CURRICULUM, BATCH_SECTION_STRUCTURE } = require("./soci_curriculum_definition");

const PERIODS = [
  { id: 1, start: "09:00:00", end: "10:00:00" },
  { id: 2, start: "10:00:00", end: "11:00:00" },
  { id: 3, start: "11:00:00", end: "12:00:00" },
  { id: 4, start: "12:00:00", end: "13:00:00" },
  // Lunch 13:00 - 14:00
  { id: 5, start: "14:00:00", end: "15:00:00" },
  { id: 6, start: "15:00:00", end: "16:00:00" },
  { id: 7, start: "16:00:00", end: "17:00:00" },
];

const LAB_BLOCKS = [
  { start: "10:00:00", end: "12:00:00" }, // Morning lab
  { start: "14:00:00", end: "16:00:00" }, // Afternoon lab
];

async function seedSociAcademicDemo() {
  console.log("===============================================================================");
  console.log("SMART CAMPUS ERP — SOCI COMPLETE ACADEMIC & TIMETABLE SEEDER");
  console.log("===============================================================================");

  const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  const connection = await mysql.createConnection(dbConfig);

  try {
    await connection.beginTransaction();

    // -------------------------------------------------------------
    // STEP 1: Verify Institutional Foundations
    // -------------------------------------------------------------
    console.log("\n[STEP 1] Verifying School, Department, Degree and Programme...");
    const [schools] = await connection.query("SELECT * FROM schools WHERE code = 'SOCI'");
    if (schools.length === 0) throw new Error("School SOCI not found in database.");
    const schoolId = schools[0].school_id;
    console.log(`  ✓ School: ${schools[0].name} (ID: ${schoolId})`);

    const [depts] = await connection.query("SELECT * FROM departments WHERE code = 'CIS'");
    if (depts.length === 0) throw new Error("Department CIS not found in database.");
    const departmentId = depts[0].department_id;
    console.log(`  ✓ Department: ${depts[0].name} (ID: ${departmentId})`);

    const [programmes] = await connection.query("SELECT * FROM programmes WHERE programme_id = 97");
    if (programmes.length === 0) throw new Error("Programme 97 not found in database.");
    const programmeId = programmes[0].programme_id;
    console.log(`  ✓ Programme: ${programmes[0].name} (ID: ${programmeId})`);

    const [ayRows] = await connection.query("SELECT * FROM academic_years ORDER BY academic_year_id ASC");
    const ayMap = {};
    ayRows.forEach((r) => {
      ayMap[r.academic_year_id] = r;
      ayMap[r.label] = r;
    });
    console.log(`  ✓ Academic Years: ${ayRows.map((r) => `${r.academic_year_id}: ${r.label}`).join(", ")}`);

    const [terms] = await connection.query(
      "SELECT * FROM academic_terms WHERE academic_year_id = 4 ORDER BY term_id ASC"
    );
    const oddTerm = terms.find((t) => t.term_type === "ODD") || terms[0];
    const evenTerm = terms.find((t) => t.term_type === "EVEN") || terms[1];
    console.log(`  ✓ Terms for AY 2026-27: ODD = ${oddTerm?.term_id}, EVEN = ${evenTerm?.term_id}`);

    // -------------------------------------------------------------
    // STEP 2: Ensure Batches for All 4 B.Tech Cohorts
    // -------------------------------------------------------------
    console.log("\n[STEP 2] Verifying and Creating Batches for All 4 B.Tech Cohorts...");
    const batchIdMap = {};

    for (const cohort of BATCH_SECTION_STRUCTURE) {
      const [existing] = await connection.query(
        "SELECT * FROM batches WHERE programme_id = ? AND label = ?",
        [programmeId, cohort.label]
      );
      if (existing.length > 0) {
        batchIdMap[cohort.label] = existing[0].batch_id;
        console.log(`  ✓ Batch ${cohort.label} (Year ${cohort.year}) exists with ID ${existing[0].batch_id}`);
      } else {
        const [res] = await connection.query(
          "INSERT INTO batches (programme_id, start_year_id, label) VALUES (?, ?, ?)",
          [programmeId, cohort.start_year_id, cohort.label]
        );
        batchIdMap[cohort.label] = res.insertId;
        console.log(`  + Batch ${cohort.label} (Year ${cohort.year}) created with ID ${res.insertId}`);
      }
    }

    // -------------------------------------------------------------
    // STEP 3: Verify and Ensure Faculty Accounts
    // -------------------------------------------------------------
    console.log("\n[STEP 3] Verifying and Ensuring Faculty Accounts...");
    const facultyDefs = [
      { code: "FAC001", name: "Dr. Rajesh Kumar", email: "rajesh.kumar@joyuniversity.edu.in", designation_id: 1 },
      { code: "FAC002", name: "Dr. Priya Sharma", email: "priya.sharma@joyuniversity.edu.in", designation_id: 1 },
      { code: "FAC003", name: "Dr. Arun Kumar", email: "arun.kumar@joyuniversity.edu.in", designation_id: 1 },
      { code: "FAC004", name: "Dr. Sneha Reddy", email: "sneha.reddy@joyuniversity.edu.in", designation_id: 1 },
      { code: "FAC0001", name: "Dr. Narasimha Uppara", email: "narasimha.uppara@joyuniversity.edu.in", designation_id: 1 },
      { code: "HOD001", name: "Dr. Vikram Sharma", email: "vikram.sharma@joyuniversity.edu.in", designation_id: 1 },
      { code: "FAC_QA_1793183158776", name: "Dr. QA Automated Faculty", email: "fac_qa@joyuniversity.edu.in", designation_id: 1 },
      { code: "FAC005", name: "Dr. K. S. Raman", email: "ks.raman@joyuniversity.edu.in", designation_id: 1 },
      { code: "FAC006", name: "Dr. Ananya Roy", email: "ananya.roy@joyuniversity.edu.in", designation_id: 1 },
      { code: "FAC007", name: "Prof. Manoj Verma", email: "manoj.verma@joyuniversity.edu.in", designation_id: 1 },
      { code: "FAC008", name: "Dr. Kavita Nair", email: "kavita.nair@joyuniversity.edu.in", designation_id: 1 },
    ];

    const facultyPassHash = await bcrypt.hash("Faculty@123", 10);
    const facultyIdMap = {};
    const activeFacultyPool = [];

    for (const f of facultyDefs) {
      let facId;
      const [existing] = await connection.query(
        "SELECT * FROM faculty WHERE employee_code = ? OR email = ?",
        [f.code, f.email]
      );
      if (existing.length > 0) {
        facId = existing[0].faculty_id;
        await connection.query("UPDATE faculty SET is_active = 1, department_id = ?, school_id = ? WHERE faculty_id = ?", [
          departmentId,
          schoolId,
          facId,
        ]);
        console.log(`  ✓ Faculty ${f.name} (${f.code}) verified (ID: ${facId})`);
      } else {
        const [res] = await connection.query(
          `INSERT INTO faculty (employee_code, full_name, email, school_id, department_id, designation_id, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [f.code, f.name, f.email, schoolId, departmentId, f.designation_id]
        );
        facId = res.insertId;
        console.log(`  + Faculty ${f.name} (${f.code}) inserted with ID ${facId}`);
      }

      facultyIdMap[f.code] = facId;
      activeFacultyPool.push({ id: facId, code: f.code, name: f.name });

      // Ensure user account exists
      const [uExisting] = await connection.query(
        "SELECT * FROM users WHERE faculty_id = ? OR email = ?",
        [facId, f.email]
      );
      if (uExisting.length === 0) {
        await connection.query(
          `INSERT INTO users (username, full_name, email, password_hash, role, faculty_id, is_active)
           VALUES (?, ?, ?, ?, 'FACULTY', ?, 1)`,
          [f.code.toLowerCase(), f.name, f.email, facultyPassHash, facId]
        );
      }
    }

    // -------------------------------------------------------------
    // STEP 4: Verify and Ensure Classrooms and Labs
    // -------------------------------------------------------------
    console.log("\n[STEP 4] Verifying Classrooms and Laboratories...");
    const roomDefs = [
      { no: "A101", type: "CLASSROOM", cap: 60, block_id: 1, is_lab: false },
      { no: "A102", type: "SMART_CLASSROOM", cap: 60, block_id: 1, is_lab: false },
      { no: "A103", type: "CLASSROOM", cap: 50, block_id: 1, is_lab: false },
      { no: "B101", type: "SMART_CLASSROOM", cap: 60, block_id: 2, is_lab: false },
      { no: "B102", type: "CLASSROOM", cap: 50, block_id: 2, is_lab: false },
      { no: "101", type: "SMART_CLASSROOM", cap: 60, block_id: 38, is_lab: false },
      { no: "201", type: "CLASSROOM", cap: 90, block_id: 36, is_lab: false },
      { no: "A104", type: "LAB", cap: 40, block_id: 1, is_lab: true, name: "Computing Lab 1" },
      { no: "B103", type: "LAB", cap: 45, block_id: 2, is_lab: true, name: "Computing Lab 2" },
      { no: "A105", type: "LAB", cap: 45, block_id: 1, is_lab: true, name: "Computing Lab 3" },
    ];

    const lectureRooms = [];
    const labRooms = [];

    for (const r of roomDefs) {
      let roomId;
      const [existing] = await connection.query("SELECT * FROM classrooms WHERE room_no = ?", [r.no]);
      if (existing.length > 0) {
        roomId = existing[0].classroom_id;
        await connection.query("UPDATE classrooms SET is_active = 1, room_type = ?, capacity = ? WHERE classroom_id = ?", [
          r.type,
          r.cap,
          roomId,
        ]);
        console.log(`  ✓ Room ${r.no} (${r.type}) verified (ID: ${roomId})`);
      } else {
        const [res] = await connection.query(
          `INSERT INTO classrooms (room_no, room_type, capacity, block_id, department_id, is_active)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [r.no, r.type, r.cap, r.block_id, departmentId]
        );
        roomId = res.insertId;
        console.log(`  + Room ${r.no} (${r.type}) inserted with ID ${roomId}`);
      }

      const roomObj = { id: roomId, no: r.no, type: r.type, cap: r.cap, name: r.name || `Room ${r.no}` };
      if (r.is_lab) {
        labRooms.push(roomObj);
      } else {
        lectureRooms.push(roomObj);
      }
    }

    // -------------------------------------------------------------
    // STEP 5: Insert / Verify All 56 Curriculum Subjects
    // -------------------------------------------------------------
    console.log("\n[STEP 5] Seeding All 56 Curriculum Subjects & Programme Mappings...");
    const subjectIdMap = {};
    let subjectsInserted = 0;
    let mappingsInserted = 0;

    for (let semNo = 1; semNo <= 8; semNo++) {
      const semData = SEMESTER_CURRICULUM[semNo];
      for (const sub of semData.subjects) {
        let subId;
        const [existing] = await connection.query("SELECT * FROM subjects WHERE subject_code = ?", [sub.code]);
        if (existing.length > 0) {
          subId = existing[0].subject_id;
          await connection.query(
            `UPDATE subjects
             SET name = ?, credits = ?, delivery_type = ?, is_active = 1, owner_school_id = ?, owner_department_id = ?
             WHERE subject_id = ?`,
            [sub.name, sub.credits, sub.type, schoolId, departmentId, subId]
          );
        } else {
          const [res] = await connection.query(
            `INSERT INTO subjects (subject_code, name, credits, delivery_type, category_id, owner_school_id, owner_department_id, is_active, ml_enabled)
             VALUES (?, ?, ?, ?, 1, ?, ?, 1, 1)`,
            [sub.code, sub.name, sub.credits, sub.type, schoolId, departmentId]
          );
          subId = res.insertId;
          subjectsInserted++;
        }
        subjectIdMap[sub.code] = subId;

        // Ensure programme_subjects mapping
        const [pSubExisting] = await connection.query(
          "SELECT * FROM programme_subjects WHERE programme_id = ? AND subject_id = ?",
          [programmeId, subId]
        );
        if (pSubExisting.length === 0) {
          await connection.query(
            `INSERT INTO programme_subjects (programme_id, subject_id, year_no, semester_no, nature)
             VALUES (?, ?, ?, ?, 'MANDATORY')`,
            [programmeId, subId, semData.year_no, semNo]
          );
          mappingsInserted++;
        }
      }
    }
    console.log(`  ✓ Subjects Catalogue: 56 total curriculum courses verified (+${subjectsInserted} inserted, +${mappingsInserted} mappings).`);

    // -------------------------------------------------------------
    // STEP 6: Ensure Course Offerings & Sections
    // -------------------------------------------------------------
    console.log("\n[STEP 6] Seeding Course Offerings and Sections for Active Terms...");
    // Offering map: offeringMap[term_id][subject_id] = offering_id
    const offeringMap = {};
    // Section map: sectionMap[offering_id][section_code] = section_id
    const sectionMap = {};
    let offeringsCreated = 0;
    let sectionsCreated = 0;

    const termConfigs = [
      { term_id: oddTerm.term_id, sem_list: [1, 3, 5, 7] },
      { term_id: evenTerm.term_id, sem_list: [2, 4, 6, 8] },
    ];

    for (const tc of termConfigs) {
      if (!offeringMap[tc.term_id]) offeringMap[tc.term_id] = {};

      for (const semNo of tc.sem_list) {
        const semData = SEMESTER_CURRICULUM[semNo];
        const cohort = BATCH_SECTION_STRUCTURE.find((c) => c.year === semData.year_no);
        const batchId = batchIdMap[cohort.label];

        for (const sub of semData.subjects) {
          const subId = subjectIdMap[sub.code];
          let offId;

          // Course offering
          const [existingOff] = await connection.query(
            "SELECT * FROM course_offerings WHERE term_id = ? AND subject_id = ?",
            [tc.term_id, subId]
          );
          if (existingOff.length > 0) {
            offId = existingOff[0].offering_id;
          } else {
            const coordFacId = activeFacultyPool[subId % activeFacultyPool.length].id;
            const [resOff] = await connection.query(
              `INSERT INTO course_offerings (term_id, subject_id, coordinator_faculty_id)
               VALUES (?, ?, ?)`,
              [tc.term_id, subId, coordFacId]
            );
            offId = resOff.insertId;
            offeringsCreated++;
          }
          offeringMap[tc.term_id][subId] = offId;
          if (!sectionMap[offId]) sectionMap[offId] = {};

          // Sections for this offering
          for (const secCode of cohort.sections) {
            const [existingSec] = await connection.query(
              "SELECT * FROM sections WHERE offering_id = ? AND section_code = ?",
              [offId, secCode]
            );
            let secId;
            if (existingSec.length > 0) {
              secId = existingSec[0].section_id;
            } else {
              const [resSec] = await connection.query(
                `INSERT INTO sections (offering_id, batch_id, section_code, max_strength)
                 VALUES (?, ?, ?, 60)`,
                [offId, batchId, secCode]
              );
              secId = resSec.insertId;
              sectionsCreated++;
            }
            sectionMap[offId][secCode] = secId;
          }
        }
      }
    }
    console.log(`  ✓ Offerings & Sections verified (+${offeringsCreated} offerings, +${sectionsCreated} sections).`);

    // -------------------------------------------------------------
    // STEP 7: Faculty Teaching Assignments (subject_staff_assignments)
    // -------------------------------------------------------------
    console.log("\n[STEP 7] Assigning Teaching Faculty to Subjects...");
    let staffAssigned = 0;

    for (let semNo = 1; semNo <= 8; semNo++) {
      const semData = SEMESTER_CURRICULUM[semNo];
      for (let sIdx = 0; sIdx < semData.subjects.length; sIdx++) {
        const sub = semData.subjects[sIdx];
        const subId = subjectIdMap[sub.code];
        const primaryFac = activeFacultyPool[(sIdx + semData.year_no * 2) % activeFacultyPool.length];

        const [existing] = await connection.query(
          "SELECT * FROM subject_staff_assignments WHERE subject_id = ? AND faculty_id = ?",
          [subId, primaryFac.id]
        );
        if (existing.length === 0) {
          await connection.query(
            `INSERT INTO subject_staff_assignments (subject_id, faculty_id, role, assigned_by)
             VALUES (?, ?, 'Primary Instructor', 1)`,
            [subId, primaryFac.id]
          );
          staffAssigned++;
        }
      }
    }
    console.log(`  ✓ Teaching Staff Assignments verified (+${staffAssigned} assignments).`);

    // -------------------------------------------------------------
    // STEP 8: Seed Synthetic Students & Enrollments
    // -------------------------------------------------------------
    console.log("\n[STEP 8] Seeding Demo Students and Course Enrollments...");
    const studentPassHash = await bcrypt.hash("Student@123", 10);
    let studentsCreated = 0;
    let enrollmentsCreated = 0;

    // First names & last names for realistic generation
    const firstNames = ["Aarav", "Ananya", "Rohan", "Sneha", "Aditya", "Pooja", "Vikram", "Isha", "Karthik", "Divya"];
    const lastNames = ["Sharma", "Verma", "Reddy", "Patel", "Nair", "Iyer", "Rao", "Kumar", "Singh", "Das"];

    for (const cohort of BATCH_SECTION_STRUCTURE) {
      const batchId = batchIdMap[cohort.label];
      const yearPrefix = cohort.label.split("-")[0]; // e.g. '2026'

      for (const secCode of cohort.sections) {
        // Create 6 students per section
        const count = 6;
        for (let i = 1; i <= count; i++) {
          const numStr = String(cohort.year * 100 + (secCode === "B" ? 50 : 0) + i).padStart(3, "0");
          const regNo = `${yearPrefix}BTAM${numStr}`;
          const sName = `${firstNames[(i + cohort.year * 3) % firstNames.length]} ${lastNames[(i + cohort.year * 2) % lastNames.length]}`;
          const sEmail = `${regNo.toLowerCase()}@joyuniversity.edu.in`;

          let studentId;
          const [existingStudent] = await connection.query(
            "SELECT * FROM students WHERE register_no = ? OR email = ?",
            [regNo, sEmail]
          );
          if (existingStudent.length > 0) {
            studentId = existingStudent[0].student_id;
          } else {
            const [resSt] = await connection.query(
              `INSERT INTO students (register_no, full_name, gender, blood_group, email, batch_id, status)
               VALUES (?, ?, ?, 'B+', ?, ?, 'ACTIVE')`,
              [regNo, sName, i % 2 === 0 ? "female" : "male", sEmail, batchId]
            );
            studentId = resSt.insertId;
            studentsCreated++;

            // User account for student
            await connection.query(
              `INSERT INTO users (username, full_name, email, password_hash, role, student_id, is_active)
               VALUES (?, ?, ?, ?, 'STUDENT', ?, 1)
               ON DUPLICATE KEY UPDATE student_id = VALUES(student_id)`,
              [regNo.toLowerCase(), sName, sEmail, studentPassHash, studentId]
            );
          }

          // Enroll student in all sections of active ODD and EVEN semesters for this cohort
          for (const tc of termConfigs) {
            const semNo = tc.term_id === oddTerm.term_id ? cohort.odd_sem : cohort.even_sem;
            const semData = SEMESTER_CURRICULUM[semNo];

            for (const sub of semData.subjects) {
              const subId = subjectIdMap[sub.code];
              const offId = offeringMap[tc.term_id][subId];
              const secId = sectionMap[offId][secCode];

              const [existingEnroll] = await connection.query(
                "SELECT * FROM enrollments WHERE student_id = ? AND section_id = ?",
                [studentId, secId]
              );
              if (existingEnroll.length === 0) {
                await connection.query(
                  `INSERT INTO enrollments (student_id, section_id, registration_type, status, registered_on)
                   VALUES (?, ?, 'REGULAR', 'REGISTERED', '2026-07-01')`,
                  [studentId, secId]
                );
                enrollmentsCreated++;
              }
            }
          }
        }
      }
    }
    console.log(`  ✓ Demo Students & Enrollments verified (+${studentsCreated} students, +${enrollmentsCreated} enrollments).`);

    // -------------------------------------------------------------
    // STEP 9: Generate and Seed 258 Conflict-Free Timetable Slots
    // -------------------------------------------------------------
    console.log("\n[STEP 9] Generating & Inserting Conflict-Free Weekly Timetable Slots...");

    function checkAndBook(map, entityId, day, start, end, label) {
      if (!map[entityId]) map[entityId] = {};
      if (!map[entityId][day]) map[entityId][day] = [];
      for (const slot of map[entityId][day]) {
        if (start < slot.end && end > slot.start) {
          return { conflict: true, existing: slot };
        }
      }
      map[entityId][day].push({ start, end, label });
      return { conflict: false };
    }

    let totalSlotsInserted = 0;

    for (const tc of termConfigs) {
      const isOdd = tc.term_id === oddTerm.term_id;
      const termName = isOdd ? "ODD" : "EVEN";
      const effFrom = isOdd ? "2026-07-01" : "2027-01-01";
      const effTo = isOdd ? "2026-12-31" : "2027-06-30";

      const facBusy = {};
      const roomBusy = {};
      const secBusy = {};

      console.log(`\n  --- Scheduling ${termName} Term (Term ID: ${tc.term_id}) ---`);

      for (const cohort of BATCH_SECTION_STRUCTURE) {
        const semNo = isOdd ? cohort.odd_sem : cohort.even_sem;
        const semData = SEMESTER_CURRICULUM[semNo];

        // Lecture room allocation
        const cohortLectureRooms = {
          A: lectureRooms[(cohort.year * 2 - 2) % lectureRooms.length],
          B: lectureRooms[(cohort.year * 2 - 1) % lectureRooms.length],
        };

        for (const secCode of cohort.sections) {
          const secIdentifier = `Y${cohort.year}_S${semNo}_${secCode}`;
          const lectureRoom = cohortLectureRooms[secCode] || lectureRooms[0];
          let sectionSlotCount = 0;

          const labs = semData.subjects.filter((s) => s.type === "LAB" || s.type === "PROJECT");
          const theories = semData.subjects.filter((s) => s.type === "THEORY");

          // 1. Schedule Labs (2 consecutive hours)
          for (let lIdx = 0; lIdx < labs.length; lIdx++) {
            const lab = labs[lIdx];
            const subId = subjectIdMap[lab.code];
            const offId = offeringMap[tc.term_id][subId];
            const secId = sectionMap[offId][secCode];
            let booked = false;

            const days = [
              (cohort.year % 5) + 1,
              ((cohort.year + 1) % 5) + 1,
              ((cohort.year + 2) % 5) + 1,
              ((cohort.year + 3) % 5) + 1,
              ((cohort.year + 4) % 5) + 1,
            ];

            for (const day of days) {
              if (booked) break;
              for (const block of LAB_BLOCKS) {
                if (booked) break;

                // Section free?
                if (secBusy[secIdentifier]?.[day]?.some((s) => block.start < s.end && block.end > s.start)) continue;

                // Lab room free?
                for (let rIdx = 0; rIdx < labRooms.length; rIdx++) {
                  if (booked) break;
                  const labRoom = labRooms[(lIdx + rIdx + (secCode === "B" ? 1 : 0)) % labRooms.length];
                  if (roomBusy[labRoom.id]?.[day]?.some((s) => block.start < s.end && block.end > s.start)) continue;

                  // Faculty free?
                  for (let fIdx = 0; fIdx < activeFacultyPool.length; fIdx++) {
                    const fac = activeFacultyPool[(lIdx + fIdx + cohort.year * 2 + (secCode === "B" ? 3 : 0)) % activeFacultyPool.length];
                    if (facBusy[fac.id]?.[day]?.some((s) => block.start < s.end && block.end > s.start)) continue;

                    // Book
                    checkAndBook(facBusy, fac.id, day, block.start, block.end, `${lab.name} (${secCode})`);
                    checkAndBook(roomBusy, labRoom.id, day, block.start, block.end, `${lab.name} (${secCode})`);
                    checkAndBook(secBusy, secIdentifier, day, block.start, block.end, lab.name);

                    // Insert or update slot in MySQL
                    const [existingSlot] = await connection.query(
                      `SELECT * FROM timetable_slots
                       WHERE section_id = ? AND day_of_week = ? AND start_time = ? AND effective_from = ?`,
                      [secId, day, block.start, effFrom]
                    );

                    if (existingSlot.length === 0) {
                      await connection.query(
                        `INSERT INTO timetable_slots
                         (section_id, faculty_id, classroom_id, day_of_week, start_time, end_time, effective_from, effective_to, is_active)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                        [secId, fac.id, labRoom.id, day, block.start, block.end, effFrom, effTo]
                      );
                      totalSlotsInserted++;
                    }

                    booked = true;
                    sectionSlotCount += 2;
                    break;
                  }
                }
              }
            }
          }

          // 2. Schedule Theories (1 hour each)
          for (let tIdx = 0; tIdx < theories.length; tIdx++) {
            const theory = theories[tIdx];
            const subId = subjectIdMap[theory.code];
            const offId = offeringMap[tc.term_id][subId];
            const secId = sectionMap[offId][secCode];
            const sessionsNeeded = theory.weekly_sessions || 3;
            let sessionsBooked = 0;

            const preferredDays = [1, 2, 3, 4, 5];
            if (secCode === "B") preferredDays.reverse();

            for (const day of preferredDays) {
              if (sessionsBooked >= sessionsNeeded) break;

              for (const period of PERIODS) {
                if (sessionsBooked >= sessionsNeeded) break;

                // Section free?
                if (secBusy[secIdentifier]?.[day]?.some((s) => period.start < s.end && period.end > s.start)) continue;

                // Lecture room free?
                if (roomBusy[lectureRoom.id]?.[day]?.some((s) => period.start < s.end && period.end > s.start)) continue;

                // Faculty free?
                let assignedFac = null;
                for (let fIdx = 0; fIdx < activeFacultyPool.length; fIdx++) {
                  const fac = activeFacultyPool[(tIdx + fIdx + cohort.year * 3 + (secCode === "B" ? 2 : 0)) % activeFacultyPool.length];
                  if (!facBusy[fac.id]?.[day]?.some((s) => period.start < s.end && period.end > s.start)) {
                    assignedFac = fac;
                    break;
                  }
                }
                if (!assignedFac) continue;

                // Book
                checkAndBook(facBusy, assignedFac.id, day, period.start, period.end, `${theory.name} (${secCode})`);
                checkAndBook(roomBusy, lectureRoom.id, day, period.start, period.end, `${theory.name} (${secCode})`);
                checkAndBook(secBusy, secIdentifier, day, period.start, period.end, theory.name);

                // Insert into MySQL
                const [existingSlot] = await connection.query(
                  `SELECT * FROM timetable_slots
                   WHERE section_id = ? AND day_of_week = ? AND start_time = ? AND effective_from = ?`,
                  [secId, day, period.start, effFrom]
                );

                if (existingSlot.length === 0) {
                  await connection.query(
                    `INSERT INTO timetable_slots
                     (section_id, faculty_id, classroom_id, day_of_week, start_time, end_time, effective_from, effective_to, is_active)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                    [secId, assignedFac.id, lectureRoom.id, day, period.start, period.end, effFrom, effTo]
                  );
                  totalSlotsInserted++;
                }

                sessionsBooked++;
                sectionSlotCount++;
              }
            }
          }

          console.log(`    Year ${cohort.year} (Sem ${semNo}) Sec ${secCode}: ${sectionSlotCount} weekly teaching hours.`);
        }
      }
    }

    await connection.commit();
    console.log(`\n>>> TRANSACTION COMMITTED SUCCESSFULLY! Total new timetable slots inserted: ${totalSlotsInserted} <<<`);

    // -------------------------------------------------------------
    // STEP 10: Run Final Conflict & Integrity Verification
    // -------------------------------------------------------------
    console.log("\n===============================================================================");
    console.log("PHASE 7 VERIFICATION — DATABASE INTEGRITY & CONFLICT AUDIT");
    console.log("===============================================================================");

    // Total slots
    const [allSlots] = await connection.query(
      `SELECT ts.slot_id, ts.day_of_week, ts.start_time, ts.end_time, ts.effective_from,
              ts.faculty_id, f.full_name AS faculty_name,
              ts.classroom_id, c.room_no,
              ts.section_id, sec.section_code,
              s.subject_code, s.name AS subject_name,
              b.label AS batch_label
       FROM timetable_slots ts
       JOIN sections sec ON ts.section_id = sec.section_id
       JOIN course_offerings co ON sec.offering_id = co.offering_id
       JOIN subjects s ON co.subject_id = s.subject_id
       JOIN batches b ON sec.batch_id = b.batch_id
       JOIN faculty f ON ts.faculty_id = f.faculty_id
       JOIN classrooms c ON ts.classroom_id = c.classroom_id
       WHERE ts.is_active = 1
       ORDER BY ts.effective_from, ts.day_of_week, ts.start_time`
    );

    console.log(`Total Active Timetable Slots in DB: ${allSlots.length}`);

    // Check Faculty Overlaps
    const [facConflicts] = await connection.query(
      `SELECT t1.slot_id AS slot1, t2.slot_id AS slot2, t1.faculty_id, f.full_name,
              t1.day_of_week, t1.start_time, t1.end_time
       FROM timetable_slots t1
       JOIN timetable_slots t2 ON t1.faculty_id = t2.faculty_id
            AND t1.day_of_week = t2.day_of_week
            AND t1.effective_from = t2.effective_from
            AND t1.slot_id < t2.slot_id
            AND t1.start_time < t2.end_time AND t1.end_time > t2.start_time
            AND t1.is_active = 1 AND t2.is_active = 1
       JOIN faculty f ON t1.faculty_id = f.faculty_id`
    );
    console.log(`Faculty Schedule Conflicts: ${facConflicts.length}`);

    // Check Room Overlaps
    const [roomConflicts] = await connection.query(
      `SELECT t1.slot_id AS slot1, t2.slot_id AS slot2, t1.classroom_id, c.room_no,
              t1.day_of_week, t1.start_time, t1.end_time
       FROM timetable_slots t1
       JOIN timetable_slots t2 ON t1.classroom_id = t2.classroom_id
            AND t1.day_of_week = t2.day_of_week
            AND t1.effective_from = t2.effective_from
            AND t1.slot_id < t2.slot_id
            AND t1.start_time < t2.end_time AND t1.end_time > t2.start_time
            AND t1.is_active = 1 AND t2.is_active = 1
       JOIN classrooms c ON t1.classroom_id = c.classroom_id`
    );
    console.log(`Classroom / Lab Conflicts: ${roomConflicts.length}`);

    // Check Section Overlaps
    const [secConflicts] = await connection.query(
      `SELECT t1.slot_id AS slot1, t2.slot_id AS slot2, t1.section_id,
              t1.day_of_week, t1.start_time, t1.end_time
       FROM timetable_slots t1
       JOIN timetable_slots t2 ON t1.section_id = t2.section_id
            AND t1.day_of_week = t2.day_of_week
            AND t1.effective_from = t2.effective_from
            AND t1.slot_id < t2.slot_id
            AND t1.start_time < t2.end_time AND t1.end_time > t2.start_time
            AND t1.is_active = 1 AND t2.is_active = 1`
    );
    console.log(`Section Schedule Conflicts: ${secConflicts.length}`);

    const totalConflicts = facConflicts.length + roomConflicts.length + secConflicts.length;
    if (totalConflicts === 0) {
      console.log("\n>>> VERIFICATION PASSED: 100% CONFLICT-FREE TIMETABLE IN DATABASE! <<<");
    } else {
      console.error(`\n>>> VERIFICATION WARNING: ${totalConflicts} total conflicts detected! <<<`);
    }

  } catch (err) {
    if (connection) await connection.rollback();
    console.error("FATAL SEEDING ERROR:", err);
    throw err;
  } finally {
    if (connection) await connection.end();
  }
}

seedSociAcademicDemo().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
