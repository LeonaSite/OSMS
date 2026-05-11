// adminRoutes/unitManager.js

const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middleware/auth");
const { logAudit } = require("../utils/auditLogger");

// GET ALL UNITS
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT UnitID, UnitName
      FROM Units
      ORDER BY UnitID DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to fetch units",
    });
  }
});

// ADD UNIT
router.post("/", verifyToken, async (req, res) => {
  try {
    const { UnitName } = req.body;

    const adminID = req.user.userId;

    await pool.execute(
      `
        INSERT INTO Units (UnitName)
        VALUES (?)
      `,
      [UnitName.toUpperCase()],
    );

    // AUDIT
    await logAudit({
      location: "Unit Manager",
      action: "Create Unit",
      adminID,
      details: `${UnitName} created.`,
    });

    res.json({
      message: "Unit added successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to add unit",
    });
  }
});

// UPDATE UNIT
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { UnitName } = req.body;

    const adminID = req.user.userId;

    // GET OLD UNIT
    const [oldRows] = await pool.execute(
      `
        SELECT UnitName
        FROM Units
        WHERE UnitID = ?
      `,
      [id],
    );

    if (!oldRows.length) {
      return res.status(404).json({
        error: "Unit not found",
      });
    }

    const oldName = oldRows[0].UnitName;

    // UPDATE
    await pool.execute(
      `
        UPDATE Units
        SET UnitName = ?
        WHERE UnitID = ?
      `,
      [UnitName.toUpperCase(), id],
    );

    // AUDIT
    await logAudit({
      location: "Unit Manager",
      action: "Edit Unit",
      adminID,
      details: `${oldName} changed name to ${UnitName}.`,
    });

    res.json({
      message: "Unit updated successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to update unit",
    });
  }
});

// DELETE UNIT
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const adminID = req.user.userId;

    // GET UNIT
    const [oldRows] = await pool.execute(
      `
        SELECT UnitName
        FROM Units
        WHERE UnitID = ?
      `,
      [id],
    );

    if (!oldRows.length) {
      return res.status(404).json({
        error: "Unit not found",
      });
    }

    const unitName = oldRows[0].UnitName;

    // DELETE
    await pool.execute(
      `
        DELETE FROM Units
        WHERE UnitID = ?
      `,
      [id],
    );

    // AUDIT
    await logAudit({
      location: "Unit Manager",
      action: "Delete Unit",
      adminID,
      details: `${unitName} deleted.`,
    });

    res.json({
      message: "Unit deleted successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to delete unit",
    });
  }
});

module.exports = router;
