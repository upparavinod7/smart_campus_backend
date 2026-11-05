const fs = require("fs");
const path = require("path");
const pool = require("../../config/mysql");
const { logAcademicEvent } = require("../../utils/academicLedger");
const { extractTextFromMaterial } = require("../../utils/textExtractor");
const { STORAGE_DIR } = require("../../utils/multipart");

/**
 * GET /api/v1/academic/topics/:id/materials
 */
async function getTopicMaterials(req, res) {
  try {
    const topicId = req.params.id;
    const user = req.user;

    let sql = `
      SELECT m.*,
        u.username AS author_username,
        u.full_name AS author_name
      FROM academic_materials m
      LEFT JOIN users u ON m.created_by = u.user_id
      WHERE m.topic_id = ?
    `;
    const params = [topicId];

    if (user.role === "STUDENT") {
      sql += " AND m.status = 'Published'";
    }

    sql += " ORDER BY m.position ASC, m.material_id ASC";

    const [materials] = await pool.query(sql, params);

    // If student, attach student's progress
    if (user.role === "STUDENT") {
      const [progress] = await pool.query(
        "SELECT * FROM academic_material_progress WHERE person_id = ? AND material_id IN (?)",
        [user.user_id, materials.map((m) => m.material_id).concat(0)],
      );

      const progressMap = new Map();
      progress.forEach((p) => progressMap.set(p.material_id, p));

      materials.forEach((m) => {
        const prog = progressMap.get(m.material_id);
        m.user_progress = prog || {
          percent: 0,
          status: "NOT_STARTED",
          completed_at: null,
        };
      });
    }

    return res.status(200).json({
      success: true,
      count: materials.length,
      data: materials,
    });
  } catch (err) {
    console.error("[AcademicMaterial] getTopicMaterials error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * POST /api/v1/academic/topics/:id/materials
 */
async function createMaterial(req, res) {
  try {
    const topicId = req.params.id;
    const user = req.user;
    const {
      title,
      type,
      description,
      required_flag,
      status = "Draft",
      position,
      link_url,
      notes_content,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Material title is required" });
    }

    const validTypes = ["PDF", "Video", "Slide", "Link", "Notes"];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid material type '${type}'. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    // Verify topic exists
    const [topicRows] = await pool.query("SELECT * FROM academic_topics WHERE topic_id = ?", [topicId]);
    if (topicRows.length === 0) {
      return res.status(404).json({ success: false, message: "Topic not found" });
    }

    let fileRef = null;
    let mimeType = null;
    let fileSize = null;
    let virusScanStatus = "CLEAN";

    const uploadedFile = req.file || (req.files && req.files.file && req.files.file[0]);

    if (["PDF", "Video", "Slide"].includes(type)) {
      if (!uploadedFile && !req.body.file_ref) {
        return res.status(400).json({
          success: false,
          message: `File upload is required for material type ${type}`,
        });
      }

      if (uploadedFile) {
        fileRef = uploadedFile.path;
        mimeType = uploadedFile.mimetype;
        fileSize = uploadedFile.size;
        virusScanStatus = uploadedFile.virus_scan_status || "CLEAN";
      } else if (req.body.file_ref) {
        fileRef = req.body.file_ref;
        mimeType = req.body.mime_type || "application/octet-stream";
        fileSize = req.body.file_size || 0;
      }
    } else if (type === "Link") {
      fileRef = link_url || req.body.file_ref || "";
      mimeType = "text/uri-list";
    } else if (type === "Notes") {
      fileRef = null;
      mimeType = "text/plain";
    }

    // Position calculation
    let nextPos = position;
    if (nextPos === undefined || nextPos === null) {
      const [posRows] = await pool.query(
        "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM academic_materials WHERE topic_id = ?",
        [topicId],
      );
      nextPos = posRows[0].next_pos;
    }

    // Extract text for future search and ML integration
    const extractedText = await extractTextFromMaterial({
      type,
      fileRef,
      contentText: notes_content || description,
      description,
    });

    const isRequired = required_flag === true || required_flag === "1" || required_flag === 1;

    const [result] = await pool.query(
      `INSERT INTO academic_materials 
        (topic_id, type, title, description, file_ref, version, status, required_flag, position, mime_type, file_size, virus_scan_status, extracted_text_ref, created_by)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        topicId,
        type,
        title.trim(),
        description || notes_content || null,
        fileRef,
        status === "Published" ? "Published" : "Draft",
        isRequired ? 1 : 0,
        nextPos,
        mimeType,
        fileSize,
        virusScanStatus,
        extractedText,
        user.user_id,
      ],
    );

    const materialId = result.insertId;

    // Record initial version in academic_material_versions
    await pool.query(
      `INSERT INTO academic_material_versions
        (material_id, version, file_ref, mime_type, file_size, change_summary, created_by)
       VALUES (?, 1, ?, ?, ?, 'Initial creation', ?)`,
      [materialId, fileRef, mimeType, fileSize, user.user_id],
    );

    await logAcademicEvent({
      personId: user.user_id,
      locationId: `ACAD-TOPIC-${topicId}`,
      eventType: "MATERIAL_UPLOAD",
      payload: { materialId, type, title: title.trim(), isRequired, status },
    });

    return res.status(201).json({
      success: true,
      message: "Material created successfully",
      data: {
        material_id: materialId,
        topic_id: parseInt(topicId, 10),
        title: title.trim(),
        type,
        version: 1,
        status,
        required_flag: isRequired,
        position: nextPos,
        file_ref: fileRef ? path.basename(fileRef) : null,
      },
    });
  } catch (err) {
    console.error("[AcademicMaterial] createMaterial error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/v1/academic/materials/:id
 */
async function getMaterialById(req, res) {
  try {
    const materialId = req.params.id;
    const user = req.user;

    const [rows] = await pool.query(
      `SELECT m.*, t.title AS topic_title, t.subject_id, s.name AS subject_name, s.subject_code AS subject_code, s.subject_code AS code
       FROM academic_materials m
       JOIN academic_topics t ON m.topic_id = t.topic_id
       JOIN subjects s ON t.subject_id = s.subject_id
       WHERE m.material_id = ?`,
      [materialId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    const material = rows[0];

    // If student, check if material is published
    if (user.role === "STUDENT" && material.status !== "Published") {
      return res.status(403).json({ success: false, message: "Material is not yet published" });
    }

    const [versions] = await pool.query(
      "SELECT * FROM academic_material_versions WHERE material_id = ? ORDER BY version DESC",
      [materialId],
    );
    material.versions = versions;

    if (user.role === "STUDENT") {
      const [prog] = await pool.query(
        "SELECT * FROM academic_material_progress WHERE person_id = ? AND material_id = ?",
        [user.user_id, materialId],
      );
      material.user_progress = prog[0] || { percent: 0, status: "NOT_STARTED", completed_at: null };
    }

    return res.status(200).json({ success: true, data: material });
  } catch (err) {
    console.error("[AcademicMaterial] getMaterialById error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * PUT /api/v1/academic/materials/:id
 */
async function updateMaterial(req, res) {
  try {
    const materialId = req.params.id;
    const user = req.user;
    const { title, description, required_flag, status, position, change_summary } = req.body;

    const [existing] = await pool.query("SELECT * FROM academic_materials WHERE material_id = ?", [materialId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    const mat = existing[0];
    const uploadedFile = req.file || (req.files && req.files.file && req.files.file[0]);

    let newVersion = mat.version;
    let newFileRef = mat.file_ref;
    let newMime = mat.mime_type;
    let newSize = mat.file_size;

    // If a new file is uploaded or explicitly version-bumped on a published material
    if (uploadedFile) {
      newVersion += 1;
      newFileRef = uploadedFile.path;
      newMime = uploadedFile.mimetype;
      newSize = uploadedFile.size;

      await pool.query(
        `INSERT INTO academic_material_versions
          (material_id, version, file_ref, mime_type, file_size, change_summary, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [materialId, newVersion, newFileRef, newMime, newSize, change_summary || "File updated", user.user_id],
      );
    }

    const updates = ["version = ?", "file_ref = ?", "mime_type = ?", "file_size = ?"];
    const params = [newVersion, newFileRef, newMime, newSize];

    if (title !== undefined) {
      updates.push("title = ?");
      params.push(title.trim());
    }

    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }

    if (required_flag !== undefined) {
      updates.push("required_flag = ?");
      params.push(required_flag === true || required_flag === 1 || required_flag === "1" ? 1 : 0);
    }

    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status === "Published" ? "Published" : "Draft");
    }

    if (position !== undefined) {
      updates.push("position = ?");
      params.push(parseInt(position, 10));
    }

    params.push(materialId);
    await pool.query(`UPDATE academic_materials SET ${updates.join(", ")}, updated_at = NOW() WHERE material_id = ?`, params);

    await logAcademicEvent({
      personId: user.user_id,
      locationId: `ACAD-MAT-${materialId}`,
      eventType: "MATERIAL_UPDATED",
      payload: { materialId, newVersion, updates: req.body },
    });

    return res.status(200).json({ success: true, message: "Material updated successfully", version: newVersion });
  } catch (err) {
    console.error("[AcademicMaterial] updateMaterial error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * POST /api/v1/academic/materials/:id/publish
 */
async function togglePublishMaterial(req, res) {
  try {
    const materialId = req.params.id;
    const { status = "Published" } = req.body;

    const [existing] = await pool.query("SELECT * FROM academic_materials WHERE material_id = ?", [materialId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    const newStatus = status === "Published" ? "Published" : "Draft";
    await pool.query("UPDATE academic_materials SET status = ?, updated_at = NOW() WHERE material_id = ?", [
      newStatus,
      materialId,
    ]);

    await logAcademicEvent({
      personId: req.user.user_id,
      locationId: `ACAD-MAT-${materialId}`,
      eventType: newStatus === "Published" ? "MATERIAL_PUBLISHED" : "MATERIAL_UNPUBLISHED",
      payload: { materialId, status: newStatus },
    });

    return res.status(200).json({ success: true, message: `Material ${newStatus.toLowerCase()} successfully` });
  } catch (err) {
    console.error("[AcademicMaterial] togglePublishMaterial error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * DELETE /api/v1/academic/materials/:id
 */
async function deleteMaterial(req, res) {
  try {
    const materialId = req.params.id;

    const [existing] = await pool.query("SELECT * FROM academic_materials WHERE material_id = ?", [materialId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    const mat = existing[0];
    if (mat.file_ref && fs.existsSync(mat.file_ref)) {
      try {
        fs.unlinkSync(mat.file_ref);
      } catch (e) {
        console.warn("[AcademicMaterial] Could not unlink file:", e.message);
      }
    }

    await pool.query("DELETE FROM academic_materials WHERE material_id = ?", [materialId]);

    await logAcademicEvent({
      personId: req.user.user_id,
      locationId: `ACAD-MAT-${materialId}`,
      eventType: "MATERIAL_DELETED",
      payload: { materialId, title: mat.title },
    });

    return res.status(200).json({ success: true, message: "Material deleted successfully" });
  } catch (err) {
    console.error("[AcademicMaterial] deleteMaterial error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * PUT /api/v1/academic/materials/:id/progress
 * Student progress logging
 */
async function updateMaterialProgress(req, res) {
  try {
    const materialId = req.params.id;
    const user = req.user;
    const { percent = 100, status } = req.body;

    const [matRows] = await pool.query(
      `SELECT m.*, t.subject_id 
       FROM academic_materials m
       JOIN academic_topics t ON m.topic_id = t.topic_id
       WHERE m.material_id = ?`,
      [materialId],
    );
    if (matRows.length === 0) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    const numPercent = Math.min(100, Math.max(0, parseInt(percent, 10)));
    let calculatedStatus = status || (numPercent >= 100 ? "COMPLETED" : numPercent > 0 ? "IN_PROGRESS" : "NOT_STARTED");
    const completedAt = numPercent >= 100 ? new Date() : null;

    await pool.query(
      `INSERT INTO academic_material_progress (person_id, material_id, percent, status, completed_at, last_accessed_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        percent = GREATEST(percent, VALUES(percent)),
        status = CASE WHEN VALUES(percent) >= 100 THEN 'COMPLETED' ELSE VALUES(status) END,
        completed_at = CASE WHEN VALUES(percent) >= 100 AND completed_at IS NULL THEN NOW() ELSE completed_at END,
        last_accessed_at = NOW()`,
      [user.user_id, materialId, numPercent, calculatedStatus, completedAt],
    );

    await logAcademicEvent({
      personId: user.user_id,
      locationId: `ACAD-MAT-${materialId}`,
      eventType: numPercent >= 100 ? "MATERIAL_COMPLETED" : "MATERIAL_PROGRESS",
      payload: { materialId, percent: numPercent, status: calculatedStatus },
    });

    return res.status(200).json({
      success: true,
      message: "Progress updated",
      data: {
        material_id: parseInt(materialId, 10),
        percent: numPercent,
        status: calculatedStatus,
        completed_at: completedAt,
      },
    });
  } catch (err) {
    console.error("[AcademicMaterial] updateMaterialProgress error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/v1/academic/materials/:id/download
 * Serves secure file stream from storage outside web root
 */
async function downloadMaterial(req, res) {
  try {
    const materialId = req.params.id;
    const user = req.user;

    const [rows] = await pool.query(
      `SELECT m.*, t.subject_id 
       FROM academic_materials m
       JOIN academic_topics t ON m.topic_id = t.topic_id
       WHERE m.material_id = ?`,
      [materialId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    const mat = rows[0];

    if (!mat.file_ref) {
      return res.status(400).json({ success: false, message: "Material does not have an associated file" });
    }

    const resolvedPath = path.resolve(mat.file_ref);
    // Security check: ensure resolvedPath is within STORAGE_DIR
    if (!resolvedPath.startsWith(STORAGE_DIR) && !fs.existsSync(resolvedPath)) {
      return res.status(403).json({ success: false, message: "Access to the requested file path is restricted" });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, message: "Stored file not found on disk" });
    }

    await logAcademicEvent({
      personId: user.user_id,
      locationId: `ACAD-MAT-${materialId}`,
      eventType: "MATERIAL_DOWNLOAD",
      payload: { materialId, file_name: path.basename(resolvedPath) },
    });

    const filename = `${mat.title.replace(/[^a-zA-Z0-9_-]/g, "_")}${path.extname(resolvedPath)}`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", mat.mime_type || "application/octet-stream");

    const stream = fs.createReadStream(resolvedPath);
    return stream.pipe(res);
  } catch (err) {
    console.error("[AcademicMaterial] downloadMaterial error:", err);
    return res.status(500).json({ success: false, message: "Failed to download material" });
  }
}

/**
 * PUT /api/v1/academic/topics/:id/materials/reorder
 */
async function reorderMaterials(req, res) {
  const conn = await pool.getConnection();
  try {
    const topicId = req.params.id;
    const { materials } = req.body;

    if (!Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ success: false, message: "materials array is required" });
    }

    await conn.beginTransaction();

    for (const item of materials) {
      if (item.material_id && item.position !== undefined) {
        await conn.query(
          "UPDATE academic_materials SET position = ?, updated_at = NOW() WHERE material_id = ? AND topic_id = ?",
          [item.position, item.material_id, topicId],
        );
      }
    }

    await conn.commit();

    await logAcademicEvent({
      personId: req.user.user_id,
      locationId: `ACAD-TOPIC-${topicId}`,
      eventType: "MATERIALS_REORDERED",
      payload: { topicId, count: materials.length },
    });

    return res.status(200).json({ success: true, message: "Materials reordered successfully" });
  } catch (err) {
    await conn.rollback();
    console.error("[AcademicMaterial] reorderMaterials error:", err);
    return res.status(500).json({ success: false, message: "Failed to reorder materials" });
  } finally {
    conn.release();
  }
}

module.exports = {
  getTopicMaterials,
  createMaterial,
  getMaterialById,
  updateMaterial,
  togglePublishMaterial,
  deleteMaterial,
  updateMaterialProgress,
  downloadMaterial,
  reorderMaterials,
};

