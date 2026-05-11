// adminRoutes/departmentManager.js

const express = require("express");
const router = express.Router();
const pool = require("../db"); // your mysql pool file
const verifyToken = require("../middleware/auth");
const { logAudit } = require("../utils/auditLogger");
const { decrypt } = require("../encryption/crypto");

// GET DEPARTMENT STATS
router.get("/stats", async (req, res) => {
  try {
    const { year } = req.query;

    let query = `
      SELECT 
        d.DepartmentID,
        d.DepartmentName,
        d.Floor,

        COUNT(DISTINCT e.EmployeeID) AS TotalUsers,

        COALESCE(COUNT(
          CASE 
            WHEN r.StatusID = 2 THEN rd.RequestDetailsID
          END
        ), 0) AS TotalIssued,

        COALESCE(SUM(
          CASE
            WHEN r.StatusID = 2 THEN rd.Quantity
            ELSE 0
          END
        ), 0) AS Quantity,

        COALESCE(SUM(
          CASE
            WHEN r.StatusID = 2 THEN rd.Quantity * s.Price
            ELSE 0
          END
        ), 0) AS TotalAmount

      FROM Departments d

      LEFT JOIN Employees e
        ON d.DepartmentID = e.DepartmentID

      LEFT JOIN Request r
        ON e.EmployeeID = r.EmployeeID
    `;

    const params = [];

    if (year && year !== "ALL") {
      query += ` AND YEAR(r.RequestedAt) = ? `;
      params.push(year);
    }

    query += `
      LEFT JOIN RequestDetails rd
        ON r.RequestID = rd.RequestID

      LEFT JOIN Stocks s
        ON rd.StockID = s.StockID

      GROUP BY 
        d.DepartmentID,
        d.DepartmentName,
        d.Floor

      ORDER BY TotalAmount DESC
    `;

    const [rows] = await pool.query(query, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to fetch department stats",
    });
  }
});

// GET YEARS
router.get("/years", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT YEAR(RequestedAt) AS Year
      FROM Request
      ORDER BY Year DESC
    `);

    res.json(rows.map((r) => r.Year));
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
});

// GET USERS PER DEPARTMENT
router.get("/stats/:departmentID/users", async (req, res) => {
  const { departmentID } = req.params;
  const { year = "ALL" } = req.query;

  try {
    let query = `
      SELECT 
        e.EmployeeID,
        e.Firstname,
        e.Lastname,
        e.UserName,

        COALESCE(SUM(rd.Quantity), 0) AS TotalQuantity,

        COALESCE(SUM(
          CASE WHEN r.StatusID = 2 THEN rd.Quantity ELSE 0 END
        ), 0) AS AcceptedQty,

        COALESCE(SUM(
          CASE WHEN r.StatusID = 3 THEN rd.Quantity ELSE 0 END
        ), 0) AS RejectedQty,

        COALESCE(SUM(
          CASE WHEN r.StatusID = 1 THEN rd.Quantity ELSE 0 END
        ), 0) AS PendingQty,

        COALESCE(SUM(
          CASE
            WHEN r.StatusID = 2 THEN rd.Quantity * s.Price
            ELSE 0
          END
        ), 0) AS TotalAmount,

        COUNT(DISTINCT r.RequestID) AS TotalRequests,

        SUM(
          CASE WHEN r.StatusID = 2 THEN 1 ELSE 0 END
        ) AS Accepted,

        SUM(
          CASE WHEN r.StatusID = 3 THEN 1 ELSE 0 END
        ) AS Rejected,

        SUM(
          CASE WHEN r.StatusID = 1 THEN 1 ELSE 0 END
        ) AS Pending

      FROM Employees e

      LEFT JOIN Request r
        ON e.EmployeeID = r.EmployeeID

      LEFT JOIN RequestDetails rd
        ON r.RequestID = rd.RequestID

      LEFT JOIN Stocks s
        ON rd.StockID = s.StockID

      WHERE e.DepartmentID = ?
    `;

    const params = [departmentID];

    if (year !== "ALL") {
      query += ` AND YEAR(r.RequestedAt) = ? `;
      params.push(year);
    }

    query += `
      GROUP BY
        e.EmployeeID,
        e.Firstname,
        e.Lastname,
        e.UserName

      ORDER BY TotalAmount DESC
    `;

    const [rows] = await pool.query(query, params);

    const decrypted = rows.map((u) => {
      let firstname = "";
      let lastname = "";
      let username = "";

      try {
        firstname = u.Firstname ? decrypt(u.Firstname) : "";
      } catch {
        firstname = u.Firstname;
      }

      try {
        lastname = u.Lastname ? decrypt(u.Lastname) : "";
      } catch {
        lastname = u.Lastname;
      }

      try {
        username = u.UserName ? decrypt(u.UserName) : "";
      } catch {
        username = u.UserName;
      }

      return {
        ...u,
        Firstname: firstname,
        Lastname: lastname,
        UserName: username,
        FullName: `${firstname} ${lastname}`.trim(),
      };
    });

    res.json(decrypted);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to fetch users",
    });
  }
});

// GET ALL DEPARTMENTS
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        DepartmentID,
        DepartmentName,
        Floor
      FROM Departments
      ORDER BY DepartmentID DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to fetch departments",
    });
  }
});

// ADD DEPARTMENT
router.post("/", verifyToken, async (req, res) => {
  const { DepartmentName, Floor } = req.body;
  const adminID = req.user.userId;

  try {
    await pool.query(
      `
      INSERT INTO Departments (
        DepartmentName,
        Floor
      )
      VALUES (?, ?)
    `,
      [DepartmentName.toUpperCase(), Floor],
    );

    await logAudit({
      location: "Division",
      action: "Create Division",
      adminID,
      details: `${DepartmentName} created.`,
    });

    res.json({
      message: "Department added successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to add department",
    });
  }
});

// UPDATE DEPARTMENT
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { DepartmentName, Floor } = req.body;
  const adminID = req.user.userId;

  try {
    await pool.query(
      `
      UPDATE Departments
      SET
        DepartmentName = ?,
        Floor = ?
      WHERE DepartmentID = ?
    `,
      [DepartmentName.toUpperCase(), Floor, id],
    );

    await logAudit({
      location: "Division",
      action: "Edit Division",
      adminID,
      details: `${DepartmentName} updated`,
    });

    res.json({
      message: "Department updated successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to update department",
    });
  }
});

// DELETE DEPARTMENT
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const adminID = req.user.userId;

  try {
    await pool.query(
      `
      DELETE FROM Departments
      WHERE DepartmentID = ?
    `,
      [id],
    );

    await logAudit({
      location: "Division",
      action: "Delete Division",
      adminID,
      details: `Department deleted`,
    });

    res.json({
      message: "Department deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to delete department",
    });
  }
});

module.exports = router;
