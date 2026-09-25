const pool = require("../config/mysql");

// GET /api/v1/blocks
const getBlocks = async (req, res) => {
  try {
    const [blocks] = await pool.query(
      `
            SELECT
                block_id,
                code,
                name,
                is_active,
                created_at,
                updated_at
            FROM blocks
            ORDER BY block_id
            `,
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

// GET /api/v1/blocks/:id
const getBlockById = async (req, res) => {
  try {
    const { id } = req.params;

    const [blocks] = await pool.query(
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

// POST /api/v1/blocks
const createBlock = async (req, res) => {
  try {
    const { code, name, is_active } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        success: false,
        message: "code and name are required",
      });
    }

    // Check duplicate code
    const [existingBlocks] = await pool.query(
      `
            SELECT block_id
            FROM blocks
            WHERE code = ?
            LIMIT 1
            `,
      [code],
    );

    if (existingBlocks.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Block code already exists",
      });
    }

    const [result] = await pool.query(
      `
            INSERT INTO blocks
                (code, name, is_active)
            VALUES
                (?, ?, ?)
            `,
      [code, name, is_active ?? 1],
    );

    return res.status(201).json({
      success: true,
      message: "Block created successfully",
      data: {
        block_id: result.insertId,
        code,
        name,
        is_active: is_active ?? 1,
      },
    });
  } catch (error) {
    console.error("Create block error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PUT /api/v1/blocks/:id
const updateBlock = async (req, res) => {
  try {
    const { id } = req.params;

    const { code, name, is_active } = req.body;

    const [existingBlocks] = await pool.query(
      `
            SELECT *
            FROM blocks
            WHERE block_id = ?
            LIMIT 1
            `,
      [id],
    );

    if (existingBlocks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Block not found",
      });
    }

    const block = existingBlocks[0];

    // Check duplicate code if code is being changed
    if (code !== undefined && code !== block.code) {
      const [duplicateBlocks] = await pool.query(
        `
                SELECT block_id
                FROM blocks
                WHERE code = ?
                  AND block_id != ?
                LIMIT 1
                `,
        [code, id],
      );

      if (duplicateBlocks.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Block code already exists",
        });
      }
    }

    const updatedBlock = {
      code: code ?? block.code,
      name: name ?? block.name,
      is_active: is_active ?? block.is_active,
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

    return res.status(200).json({
      success: true,
      message: "Block updated successfully",
      data: {
        block_id: Number(id),
        ...updatedBlock,
      },
    });
  } catch (error) {
    console.error("Update block error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE /api/v1/blocks/:id
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
