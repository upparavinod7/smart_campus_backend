const { SEMESTER_CURRICULUM, BATCH_SECTION_STRUCTURE } = require("./soci_curriculum_definition");

// Standard periods
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
  { start: "10:00:00", end: "12:00:00" }, // Morning lab (Periods 2 & 3)
  { start: "14:00:00", end: "16:00:00" }, // Afternoon lab (Periods 5 & 6)
];

// Faculty pool (existing faculty + designated faculty)
const FACULTY = [
  { id: 1, code: "FAC001", name: "Dr. Rajesh Kumar" },
  { id: 2, code: "FAC002", name: "Dr. Priya Sharma" },
  { id: 3, code: "FAC003", name: "Dr. Arun Kumar" },
  { id: 4, code: "FAC004", name: "Dr. Sneha Reddy" },
  { id: 111, code: "FAC0001", name: "Dr. Narasimha Uppara" },
  { id: 156, code: "HOD001", name: "Dr. Vikram Sharma (HOD)" },
  { id: 105, code: "FAC005", name: "Dr. K. S. Raman" },
  { id: 106, code: "FAC006", name: "Dr. Ananya Roy" },
  { id: 107, code: "FAC007", name: "Prof. Manoj Verma" },
  { id: 108, code: "FAC008", name: "Dr. Kavita Nair" },
];

// Rooms pool
const ROOMS = {
  classrooms: [
    { id: 1, no: "A101", cap: 60 },
    { id: 2, no: "A102", cap: 60 },
    { id: 3, no: "A103", cap: 50 },
    { id: 5, no: "B101", cap: 60 },
    { id: 6, no: "B102", cap: 50 },
    { id: 92, no: "101", cap: 60 },
    { id: 158, no: "201", cap: 90 },
  ],
  labs: [
    { id: 4, no: "A104", name: "Computing Lab 1", cap: 40 },
    { id: 7, no: "B103", name: "Computing Lab 2", cap: 40 },
    { id: 8, no: "A105", name: "Computing Lab 3", cap: 40 },
  ],
};

function simulateTimetable() {
  console.log("===============================================================================");
  console.log("SMART CAMPUS ERP — COMPLETE SOCI TIMETABLE SIMULATION & CONFLICT VALIDATION");
  console.log("===============================================================================");

  const allSlots = [];
  const conflicts = [];

  // Busy trackers: busy[entityId][day] = [{ start, end, label }]
  const facBusy = {};
  const roomBusy = {};
  const secBusy = {};

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

  // We generate timetables for both terms:
  // Term ODD: Semesters 1, 3, 5, 7
  // Term EVEN: Semesters 2, 4, 6, 8
  const TERMS = ["ODD", "EVEN"];

  let totalScheduledHours = 0;
  let slotCounter = 1;

  for (const term of TERMS) {
    console.log(`\n>>> SCHEDULING ${term} TERM (All 4 Years) <<<`);

    // Reset busy trackers per term (ODD and EVEN terms take place in different semesters/dates)
    const facBusy = {};
    const roomBusy = {};
    const secBusy = {};

    // Days Monday (1) to Friday (5)
    const days = [1, 2, 3, 4, 5];

    // Identify active batches and semesters for this term
    const termCohorts = BATCH_SECTION_STRUCTURE.map((cohort) => {
      const semNo = term === "ODD" ? cohort.odd_sem : cohort.even_sem;
      return {
        year: cohort.year,
        batch_label: cohort.label,
        start_year_id: cohort.start_year_id,
        semester_no: semNo,
        sections: cohort.sections,
        subjects: SEMESTER_CURRICULUM[semNo].subjects,
      };
    });

    // Schedule each cohort
    for (const cohort of termCohorts) {
      console.log(`\n--- Year ${cohort.year} (Batch ${cohort.batch_label}, Semester ${cohort.semester_no}) ---`);

      // Assign default lecture classroom for each section in this cohort
      const cohortRooms = {
        A: ROOMS.classrooms[(cohort.year * 2 - 2) % ROOMS.classrooms.length],
        B: ROOMS.classrooms[(cohort.year * 2 - 1) % ROOMS.classrooms.length],
      };

      for (const sectionCode of cohort.sections) {
        const secId = `Y${cohort.year}_S${cohort.semester_no}_${sectionCode}`;
        const lectureRoom = cohortRooms[sectionCode] || ROOMS.classrooms[0];
        let sectionSlotsCount = 0;

        // Separate Theory and Labs
        const labs = cohort.subjects.filter((s) => s.type === "LAB" || s.type === "PROJECT");
        const theories = cohort.subjects.filter((s) => s.type === "THEORY");

        // 1. Schedule Labs first (consecutive 2-hour blocks)
        labs.forEach((lab, labIdx) => {
          let booked = false;

          // Try each day
          for (const day of [cohort.year % 5 + 1, (cohort.year + 1) % 5 + 1, (cohort.year + 2) % 5 + 1, (cohort.year + 3) % 5 + 1, (cohort.year + 4) % 5 + 1]) {
            if (booked) break;

            for (const block of LAB_BLOCKS) {
              if (booked) break;

              // Check if section is free in this block
              if (secBusy[secId]?.[day]?.some((s) => block.start < s.end && block.end > s.start)) continue;

              // Find an available lab room
              for (let rIdx = 0; rIdx < ROOMS.labs.length; rIdx++) {
                if (booked) break;
                const labRoom = ROOMS.labs[(labIdx + rIdx + (sectionCode === "B" ? 1 : 0)) % ROOMS.labs.length];
                if (roomBusy[labRoom.id]?.[day]?.some((s) => block.start < s.end && block.end > s.start)) continue;

                // Find an available faculty
                for (let fIdx = 0; fIdx < FACULTY.length; fIdx++) {
                  const fac = FACULTY[(labIdx + fIdx + cohort.year * 2 + (sectionCode === "B" ? 3 : 0)) % FACULTY.length];
                  if (facBusy[fac.id]?.[day]?.some((s) => block.start < s.end && block.end > s.start)) continue;

                  // Book it!
                  checkAndBook(facBusy, fac.id, day, block.start, block.end, `${lab.name} (${sectionCode})`);
                  checkAndBook(roomBusy, labRoom.id, day, block.start, block.end, `${lab.name} (${sectionCode})`);
                  checkAndBook(secBusy, secId, day, block.start, block.end, `${lab.name}`);

                  booked = true;
                  allSlots.push({
                    slot_id: slotCounter++,
                    term,
                    year: cohort.year,
                    batch_label: cohort.batch_label,
                    semester: cohort.semester_no,
                    section: sectionCode,
                    subject_code: lab.code,
                    subject_name: lab.name,
                    delivery_type: lab.type,
                    day_of_week: day,
                    start_time: block.start,
                    end_time: block.end,
                    duration_hours: 2,
                    faculty_id: fac.id,
                    faculty_name: fac.name,
                    classroom_id: labRoom.id,
                    room_no: labRoom.no,
                    room_name: labRoom.name,
                  });
                  sectionSlotsCount += 2;
                  break;
                }
              }
            }
          }

          if (!booked) {
            conflicts.push(`Could not book lab ${lab.name} for Section ${sectionCode} without conflict.`);
          }
        });

        // 2. Schedule Theory subjects (1-hour slots)
        theories.forEach((theory, thIdx) => {
          const sessionsNeeded = theory.weekly_sessions || 3;
          let sessionsBooked = 0;

          // Distribute across days
          const preferredDays = [1, 2, 3, 4, 5];
          if (sectionCode === "B") preferredDays.reverse();

          for (const day of preferredDays) {
            if (sessionsBooked >= sessionsNeeded) break;

            // Try each period
            for (const period of PERIODS) {
              if (sessionsBooked >= sessionsNeeded) break;

              // Check section busy
              if (secBusy[secId]?.[day]?.some((s) => period.start < s.end && period.end > s.start)) continue;

              // Check lecture room busy
              if (roomBusy[lectureRoom.id]?.[day]?.some((s) => period.start < s.end && period.end > s.start)) continue;

              // Find available faculty (prefer primary faculty)
              let assignedFac = null;
              for (let fIdx = 0; fIdx < FACULTY.length; fIdx++) {
                const fac = FACULTY[(thIdx + fIdx + cohort.year * 3 + (sectionCode === "B" ? 2 : 0)) % FACULTY.length];
                if (!facBusy[fac.id]?.[day]?.some((s) => period.start < s.end && period.end > s.start)) {
                  assignedFac = fac;
                  break;
                }
              }
              if (!assignedFac) continue;

              checkAndBook(facBusy, assignedFac.id, day, period.start, period.end, `${theory.name} (${sectionCode})`);
              checkAndBook(roomBusy, lectureRoom.id, day, period.start, period.end, `${theory.name} (${sectionCode})`);
              checkAndBook(secBusy, secId, day, period.start, period.end, `${theory.name}`);

              sessionsBooked++;
              allSlots.push({
                slot_id: slotCounter++,
                term,
                year: cohort.year,
                batch_label: cohort.batch_label,
                semester: cohort.semester_no,
                section: sectionCode,
                subject_code: theory.code,
                subject_name: theory.name,
                delivery_type: theory.type,
                day_of_week: day,
                start_time: period.start,
                end_time: period.end,
                duration_hours: 1,
                faculty_id: assignedFac.id,
                faculty_name: assignedFac.name,
                classroom_id: lectureRoom.id,
                room_no: lectureRoom.no,
                room_name: `Room ${lectureRoom.no}`,
              });
              sectionSlotsCount += 1;
            }
          }

          if (sessionsBooked < sessionsNeeded) {
            conflicts.push(`Theory ${theory.name} for Section ${sectionCode} booked only ${sessionsBooked}/${sessionsNeeded} sessions.`);
          }
        });

        console.log(`  Section ${sectionCode}: Successfully scheduled ${sectionSlotsCount} weekly teaching hours.`);
        totalScheduledHours += sectionSlotsCount;
      }
    }
  }

  console.log("\n===============================================================================");
  console.log(`CONFLICT VALIDATION RESULTS:`);
  console.log(`Total Timetable Slots Generated: ${allSlots.length}`);
  console.log(`Total Weekly Teaching Hours: ${totalScheduledHours} hrs`);
  console.log(`Conflicts Detected: ${conflicts.length}`);
  if (conflicts.length > 0) {
    conflicts.forEach((c) => console.error(" - " + c));
  } else {
    console.log(">>> ZERO CONFLICTS DETECTED! ALL 4 YEARS, 8 SEMESTERS & SECTIONS FULLY COMPATIBLE. <<<");
  }
  console.log("===============================================================================");

  return { allSlots, conflicts };
}

if (require.main === module) {
  simulateTimetable();
}

module.exports = { simulateTimetable };
