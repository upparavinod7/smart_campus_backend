const pool = require("../config/mysql");

/**
 * GET /api/v1/blocks
 * Retrieves all blocks with optional search and active status filtering.
 */
const getBlocks = async (req, res) => {
  try {
    const { is_active, search } = req.query;

    const conditions = [];
    const params = [];

    if (is_active !== undefined) {
      const activeVal = is_active === "true" || is_active === "1" ? 1 : 0;
      conditions.push("b.is_active = ?");
      params.push(activeVal);
    }

    if (search && typeof search === "string" && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push("(b.code LIKE ? OR b.name LIKE ?)");
      params.push(searchTerm, searchTerm);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [blocks] = await pool.query(
      `
      SELECT
          b.block_id,
          b.code,
          b.name,
          b.is_active,
          b.created_at,
          b.updated_at
      FROM blocks b
      ${whereClause}
      ORDER BY b.block_id ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Blocks retrieved successfully",
      data: blocks,
    });
  } catch (error) {
    console.error("Get blocks error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/blocks/:id
 * Retrieves a single block by ID.
 */
const getBlockById = async (req, res) => {
  try {
    const { id } = req.params;

    const [blocks] = await pool.query(
      `
      SELECT
          b.block_id,
          b.code,
          b.name,
          b.is_active,
          b.created_at,
          b.updated_at
      FROM blocks b
      WHERE b.block_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (blocks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Block not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Block retrieved successfully",
      data: blocks[0],
    });
  } catch (error) {
    console.error("Get block error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/blocks
 * Creates a new campus block. ADMIN only.
 */
const createBlock = async (req, res) => {
  try {
    const { code, name, is_active } = req.body || {};

    if (
      !code ||
      typeof code !== "string" ||
      !code.trim() ||
      !name ||
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "code and name are required",
      });
    }

    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    const activeStatus = is_active !== undefined ? (Boolean(is_active) ? 1 : 0) : 1;

    const [result] = await pool.query(
      `
      INSERT INTO blocks (code, name, is_active)
      VALUES (?, ?, ?)
      `,
      [trimmedCode, trimmedName, activeStatus],
    );

    const [created] = await pool.query(
      `
      SELECT
          block_id,
          code,
          name,
          is_active,
          created_at,
          updated_at
      FROM blocks
      WHERE block_id = ?
      LIMIT 1
      `,
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "Block created successfully",
      data: created[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Block code or name already exists",
      });
    }

    console.error("Create block error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/blocks/:id
 * Updates an existing campus block. ADMIN only.
 */
const updateBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, is_active } = req.body || {};

    const [existing] = await pool.query(
      `
      SELECT *
      FROM blocks
      WHERE block_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Block not found",
      });
    }

    const block = existing[0];

    if (code !== undefined && (typeof code !== "string" || !code.trim())) {
      return res.status(400).json({
        success: false,
        message: "code cannot be empty",
      });
    }

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({
        success: false,
        message: "name cannot be empty",
      });
    }

    const updatedBlock = {
      code: code !== undefined ? code.trim() : block.code,
      name: name !== undefined ? name.trim() : block.name,
      is_active: is_active !== undefined ? (Boolean(is_active) ? 1 : 0) : block.is_active,
    };

    await pool.query(
      `
      UPDATE blocks
      SET
          code = ?,
          name = ?,
          is_active = ?
      WHERE block_id = ?
      `,
      [updatedBlock.code, updatedBlock.name, updatedBlock.is_active, id],
    );

    const [updated] = await pool.query(
      `
      SELECT
          block_id,
          code,
          name,
          is_active,
          created_at,
          updated_at
      FROM blocks
      WHERE block_id = ?
      LIMIT 1
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Block updated successfully",
      data: updated[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Block code or name already exists",
      });
    }

    console.error("Update block error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * DELETE /api/v1/blocks/:id
 * Soft deactivates a campus block. ADMIN only.
 */
const deleteBlock = async (req, res) => {
  try {
    const { id } = req.params;

    const [blocks] = await pool.query(
      `
      SELECT block_id, is_active
      FROM blocks
      WHERE block_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (blocks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Block not found",
      });
    }

    if (!blocks[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Block is already inactive",
      });
    }

    await pool.query(
      `
      UPDATE blocks
      SET is_active = 0
      WHERE block_id = ?
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Block deactivated successfully",
    });
  } catch (error) {
    console.error("Deactivate block error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getBlocks,
  getBlockById,
  createBlock,
  updateBlock,
  deleteBlock,
};
