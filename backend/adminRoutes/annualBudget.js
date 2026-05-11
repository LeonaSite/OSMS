const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ GET all departments
router.get("/departments", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DepartmentID, DepartmentName, DistributionPercentage
      FROM Departments
      ORDER BY DepartmentName
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching departments");
  }
});

// ✅ GET Annual Budget + Department Credits
router.get("/", async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();

    const [budgetRows] = await pool.query(
      `SELECT * FROM AnnualBudget WHERE FiscalYear = ? LIMIT 1`,
      [year],
    );

    const [deptRows] = await pool.query(
      `
      SELECT 
        d.DepartmentID,
        d.DepartmentName,
        d.DistributionPercentage,
        dc.AllocatedAmount,
        dc.RemainingCredit
      FROM Departments d
      LEFT JOIN DepartmentCredits dc
        ON d.DepartmentID = dc.DepartmentID
        AND dc.FiscalYear = ?
      ORDER BY d.DepartmentName
    `,
      [year],
    );

    res.json({
      budget: budgetRows[0] || null,
      departments: deptRows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// ✅ GET ALL budgets
router.get("/all", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT FiscalYear FROM AnnualBudget
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// ✅ CREATE
router.post("/", async (req, res) => {
  const { year, amount, allocations, departments } = req.body;

  const conn = await pool.getConnection();

  try {
    if (!year || !amount || amount <= 0) {
      return res.status(400).send("Invalid year or amount");
    }

    if (!allocations || typeof allocations !== "object") {
      return res.status(400).send("Allocations are required");
    }

    await conn.beginTransaction();

    // 🔴 CHECK DUPLICATE
    const [existing] = await conn.query(
      `SELECT 1 FROM AnnualBudget WHERE FiscalYear = ?`,
      [year],
    );

    if (existing.length > 0) {
      throw new Error("Budget for this year already exists");
    }

    // 🔹 GET DEPARTMENTS
    const [departments] = await conn.query(`
      SELECT DepartmentID FROM Departments
    `);

    if (departments.length === 0) {
      throw new Error("No departments found");
    }

    // 🔹 VALIDATE allocations
    for (const dept of departments) {
      if (!(dept.DepartmentID in allocations)) {
        throw new Error(
          `Missing allocation for DepartmentID ${dept.DepartmentID}`,
        );
      }
    }

    // 🔹 VALIDATE TOTAL
    const totalAlloc = Object.values(allocations).reduce(
      (sum, val) => sum + Number(val || 0),
      0,
    );

    if (Number(totalAlloc.toFixed(2)) !== Number(amount.toFixed(2))) {
      throw new Error("Allocation mismatch");
    }

    // 🔹 INSERT ANNUAL BUDGET
    await conn.query(
      `INSERT INTO AnnualBudget (FiscalYear, Amount) VALUES (?, ?)`,
      [year, amount],
    );

    // 🔹 INSERT DEPARTMENT CREDITS
    for (const dept of departments) {
      const alloc = Number(allocations[dept.DepartmentID] || 0);

      await conn.query(
        `INSERT INTO DepartmentCredits
         (DepartmentID, FiscalYear, AllocatedAmount, RemainingCredit)
         VALUES (?, ?, ?, ?)`,
        [dept.DepartmentID, year, alloc, alloc],
      );
    }

    // 🔹 UPDATE DISTRIBUTION PERCENTAGES
    if (Array.isArray(departments)) {
      for (const dept of departments) {
        await conn.query(
          `
      UPDATE Departments
      SET DistributionPercentage = ?
      WHERE DepartmentID = ?
      `,
          [Number(dept.DistributionPercentage || 0), dept.DepartmentID],
        );
      }
    }

    await conn.commit();

    res.json({ message: "Budget created successfully" });
  } catch (err) {
    await conn.rollback();
    console.error(err);

    res.status(500).json({
      message: "Error creating budget",
      error: err.message,
    });
  } finally {
    conn.release();
  }
});

// ✅ UPDATE
router.put("/:year", async (req, res) => {
  const { amount, allocations, departments } = req.body;
  const year = req.params.year;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // UPDATE budget
    await conn.query(
      `UPDATE AnnualBudget SET Amount = ? WHERE FiscalYear = ?`,
      [amount, year],
    );

    // GET CURRENT
    const [currentCredits] = await conn.query(
      `SELECT DepartmentID, AllocatedAmount, RemainingCredit
       FROM DepartmentCredits
       WHERE FiscalYear = ?`,
      [year],
    );

    for (const row of currentCredits) {
      const deptId = row.DepartmentID;

      const used = Number(row.AllocatedAmount) - Number(row.RemainingCredit);
      const newAllocated = Number(allocations[deptId] || 0);

      if (newAllocated < used) {
        throw new Error(
          `Department ${deptId} allocation cannot be less than used (${used})`,
        );
      }

      const newRemaining = newAllocated - used;

      await conn.query(
        `UPDATE DepartmentCredits
         SET AllocatedAmount = ?, RemainingCredit = ?
         WHERE DepartmentID = ? AND FiscalYear = ?`,
        [newAllocated, newRemaining, deptId, year],
      );
    }

    // 🔹 UPDATE DISTRIBUTION PERCENTAGES
    if (Array.isArray(departments)) {
      for (const dept of departments) {
        await conn.query(
          `
      UPDATE Departments
      SET DistributionPercentage = ?
      WHERE DepartmentID = ?
      `,
          [Number(dept.DistributionPercentage || 0), dept.DepartmentID],
        );
      }
    }

    await conn.commit();

    res.json({ message: "Budget updated successfully" });
  } catch (err) {
    await conn.rollback();
    console.error(err);

    res.status(500).json({
      message: "Update failed",
      error: err.message,
    });
  } finally {
    conn.release();
  }
});

module.exports = router;
