const pool = require("../config/mysql");

// GET /api/v1/students
// ADMIN only
const getStudents = async (req, res) => {
  try {
    const [students] = await pool.query(`
      SELECT
        student_id,
        register_no,
        full_name,
        email,
        phone,
        batch_id,
        status,
        created_at,
        updated_at
      FROM students
      ORDER BY student_id ASC
    `);

    return res.status(200).json({
      success: true,
      message: "Students retrieved successfully",
      count: students.length,
      data: students,
    });
  } catch (error) {
    console.error("Get students error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /api/v1/students/:id
// ADMIN only
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const [students] = await pool.query(
      `
      SELECT
        student_id,
        register_no,
        full_name,
        email,
        phone,
        batch_id,
        status,
        created_at,
        updated_at
      FROM students
      WHERE student_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student retrieved successfully",
      data: students[0],
    });
  } catch (error) {
    console.error("Get student error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// POST /api/v1/students
// ADMIN only
const createStudent = async (req, res) => {
  try {
    const { register_no, full_name, email, phone, batch_id, status } = req.body;

    if (!register_no || !full_name || !batch_id) {
      return res.status(400).json({
        success: false,
        message: "register_no, full_name and batch_id are required",
      });
    }

    const allowedStatuses = [
      "ACTIVE",
      "SEMESTER_WITHDRAWAL",
      "INTERNSHIP_BREAK",
      "DISCIPLINARY_WITHDRAWAL",
      "TERMINATED",
      "GRADUATED",
    ];

    const studentStatus = status || "ACTIVE";

    if (!allowedStatuses.includes(studentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student status",
      });
    }

    const [existingRegister] = await pool.query(
      `
      SELECT student_id
      FROM students
      WHERE register_no = ?
      LIMIT 1
      `,
      [register_no],
    );

    if (existingRegister.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Register number already exists",
      });
    }

    const [batch] = await pool.query(
      `
      SELECT batch_id
      FROM batches
      WHERE batch_id = ?
      LIMIT 1
      `,
      [batch_id],
    );

    if (batch.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch_id",
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO students
        (register_no, full_name, email, phone, batch_id, status)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        register_no,
        full_name,
        email || null,
        phone || null,
        batch_id,
        studentStatus,
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Student created successfully",
      data: {
        student_id: result.insertId,
        register_no,
        full_name,
        email: email || null,
        phone: phone || null,
        batch_id,
        status: studentStatus,
      },
    });
  } catch (error) {
    console.error("Create student error:", error);

    // Handle unique constraint violations, such as duplicate register_no.
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A student with these unique details already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PUT /api/v1/students/:id
// ADMIN only
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const { register_no, full_name, email, phone, batch_id, status } = req.body;

    const [existingStudent] = await pool.query(
      `
      SELECT *
      FROM students
      WHERE student_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (existingStudent.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student = existingStudent[0];

    const allowedStatuses = [
      "ACTIVE",
      "SEMESTER_WITHDRAWAL",
      "INTERNSHIP_BREAK",
      "DISCIPLINARY_WITHDRAWAL",
      "TERMINATED",
      "GRADUATED",
    ];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student status",
      });
    }

    if (batch_id !== undefined && batch_id !== null) {
      const [batch] = await pool.query(
        `
        SELECT batch_id
        FROM batches
        WHERE batch_id = ?
        LIMIT 1
        `,
        [batch_id],
      );

      if (batch.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid batch_id",
        });
      }
    }

    const updatedStudent = {
      register_no: register_no ?? student.register_no,
      full_name: full_name ?? student.full_name,
      email: email ?? student.email,
      phone: phone ?? student.phone,
      batch_id: batch_id ?? student.batch_id,
      status: status ?? student.status,
    };

    await pool.query(
      `
      UPDATE students
      SET
        register_no = ?,
        full_name = ?,
        email = ?,
        phone = ?,
        batch_id = ?,
        status = ?
      WHERE student_id = ?
      `,
      [
        updatedStudent.register_no,
        updatedStudent.full_name,
        updatedStudent.email,
        updatedStudent.phone,
        updatedStudent.batch_id,
        updatedStudent.status,
        id,
      ],
    );

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: {
        student_id: Number(id),
        ...updatedStudent,
      },
    });
  } catch (error) {
    console.error("Update student error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A student with these unique details already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE /api/v1/students/:id
// ADMIN only
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const [existingStudent] = await pool.query(
      `
      SELECT student_id
      FROM students
      WHERE student_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (existingStudent.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    await pool.query(
      `
      DELETE FROM students
      WHERE student_id = ?
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    console.error("Delete student error:", error);

    // Related records may prevent deletion through foreign keys.
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete this student because related records exist",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
};
