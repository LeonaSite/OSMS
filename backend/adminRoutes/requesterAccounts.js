const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

const pool = require("../db");

const { encrypt, decrypt } = require("../encryption/crypto");
const verifyToken = require("../middleware/auth");
const { logAudit } = require("../utils/auditLogger");

// GET REQUEST YEARS
router.get("/reqyears", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT Year
      FROM (
        SELECT YEAR(RequestedAt) AS Year
        FROM Request
        WHERE RequestedAt IS NOT NULL

        UNION

        SELECT YEAR(ProcessedAt) AS Year
        FROM Request
        WHERE ProcessedAt IS NOT NULL
      ) AS Years

      ORDER BY Year DESC
    `);

    res.json(rows.map((r) => r.Year));
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// GET ALL REQUESTER ACCOUNTS
router.get("/", async (req, res) => {
  try {
    const { department } = req.query;

    let query = `
      SELECT
        E.EmployeeID,
        E.UserName,
        E.Firstname,
        E.Lastname,
        E.CreatedAt,

        D.DepartmentName,

        COUNT(RD.RequestDetailsID) AS TotalReleased,

        COALESCE(SUM(RD.Quantity), 0) AS TotalQuantity,

        COALESCE(SUM(RD.Quantity * S.Price), 0) AS TotalAmount

      FROM Employees E

      LEFT JOIN Departments D
        ON D.DepartmentID = E.DepartmentID

      LEFT JOIN Request R
        ON R.EmployeeID = E.EmployeeID
        AND R.StatusID = 2

      LEFT JOIN RequestDetails RD
        ON RD.RequestID = R.RequestID

      LEFT JOIN Stocks S
        ON RD.StockID = S.StockID
    `;

    const params = [];

    if (department) {
      query += `
        WHERE D.DepartmentName = ?
      `;

      params.push(department);
    }

    query += `
      GROUP BY
        E.EmployeeID,
        E.UserName,
        E.Firstname,
        E.Lastname,
        E.CreatedAt,
        D.DepartmentName

      ORDER BY TotalReleased DESC
    `;

    const [rows] = await pool.query(query, params);

    const data = rows.map((row, index) => ({
      index: index + 1,

      employeeID: row.EmployeeID,

      username: decrypt(row.UserName),

      fullname: `${decrypt(row.Firstname)} ${decrypt(row.Lastname)}`,

      department: row.DepartmentName,

      totalReleased: row.TotalReleased,
      totalQuantity: row.TotalQuantity,
      totalAmount: row.TotalAmount,

      createdAt: row.CreatedAt,
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// CHECK DEPARTMENT ACCOUNT COUNT
router.get("/department-count/:deptID", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM Employees
      WHERE DepartmentID = ?
    `,
      [req.params.deptID],
    );

    res.json({
      count: rows[0].count,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// CREATE REQUESTER ACCOUNT
router.post("/", verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, username, password, departmentID } = req.body;

    // REQUIRED VALIDATION
    if (!firstName || !lastName || !username || !password || !departmentID) {
      return res.status(400).json({
        message: "Invalid request",
      });
    }

    const adminID = req.user.userId;

    // CHECK DEPARTMENT LIMIT
    const [deptCount] = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM Employees
      WHERE DepartmentID = ?
    `,
      [departmentID],
    );

    if (deptCount[0].count >= 2) {
      return res.status(409).json({
        message: "Department limit reached",
      });
    }

    // GET DEPARTMENT NAME
    const [deptRows] = await pool.query(
      `
      SELECT DepartmentName
      FROM Departments
      WHERE DepartmentID = ?
    `,
      [departmentID],
    );

    const deptName = deptRows[0]?.DepartmentName || "Unknown";

    // HASH PASSWORD
    const hashedPassword = await bcrypt.hash(
      password + process.env.BCRYPT_PEPPER,
      12,
    );

    // INSERT EMPLOYEE
    await pool.query(
      `
      INSERT INTO Employees
      (
        Firstname,
        Lastname,
        UserName,
        Password,
        DepartmentID,
        CreatedAt
      )
      VALUES
      (?, ?, ?, ?, ?, UTC_TIMESTAMP())
    `,
      [
        encrypt(firstName),
        encrypt(lastName),
        encrypt(username),
        hashedPassword,
        departmentID,
      ],
    );

    const logPrefix = `[${username}] ${firstName} ${lastName}: `;

    // AUDIT LOG
    await logAudit({
      location: "Requester Account",
      action: "Create Account",
      adminID,
      details: `${logPrefix}Account created under ${deptName} department`,
    });

    res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

// GET ALL DEPARTMENTS
router.get("/departments", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        DepartmentID,
        DepartmentName,
        Floor

      FROM Departments

      ORDER BY Floor ASC, DepartmentName ASC
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// GET SINGLE EMPLOYEE
router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const [rows] = await pool.query(`
      SELECT
        E.EmployeeID,
        E.UserName,
        E.Firstname,
        E.Lastname,
        E.CreatedAt,
        E.ModifiedAt,

        D.DepartmentName

      FROM Employees E

      LEFT JOIN Departments D
        ON D.DepartmentID = E.DepartmentID
    `);

    const emp = rows.find((e) => decrypt(e.UserName) === username);

    if (!emp) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    res.json({
      employee: {
        employeeID: emp.EmployeeID,
        username: decrypt(emp.UserName),
        firstname: decrypt(emp.Firstname),
        lastname: decrypt(emp.Lastname),
        department: emp.DepartmentName,
        createdAt: emp.CreatedAt,
        modifiedAt: emp.ModifiedAt,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// GET EMPLOYEE REQUEST ITEMS
router.get("/:username/items", async (req, res) => {
  try {
    const { username } = req.params;

    const {
      status = "ALL",
      search = "",
      type = "PERSONAL",
      year = "ALL",
    } = req.query;

    // FIND EMPLOYEE
    const [employees] = await pool.query(`
      SELECT
        EmployeeID,
        UserName,
        DepartmentID
      FROM Employees
    `);

    const emp = employees.find((e) => decrypt(e.UserName) === username);

    if (!emp) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    let query = `
      SELECT
        R.RequestID,
        R.RequisitionNo,
        R.RequestedAt,
        R.ProcessedAt,

        S.StatusName,

        RD.RequestDetailsID,
        RD.Quantity,

        ST.StockName,
        ST.Description,
        ST.Price

      FROM Request R

      JOIN RequestDetails RD
        ON RD.RequestID = R.RequestID

      JOIN Stocks ST
        ON ST.StockID = RD.StockID

      JOIN Status S
        ON S.StatusID = R.StatusID

      JOIN Employees E
        ON E.EmployeeID = R.EmployeeID

      WHERE 1=1
    `;

    const params = [];

    // YEAR FILTER
    if (year !== "ALL") {
      query += `
        AND (
          YEAR(R.RequestedAt) = ?
          OR YEAR(R.ProcessedAt) = ?
        )
      `;

      params.push(year, year);
    }

    // PERSONAL FILTER
    if (type === "PERSONAL") {
      query += `
        AND R.EmployeeID = ?
      `;

      params.push(emp.EmployeeID);
    }

    // DIVISION FILTER
    if (type === "DIVISION") {
      query += `
        AND E.DepartmentID = ?
      `;

      params.push(emp.DepartmentID);
    }

    query += `
      ORDER BY R.RequestedAt DESC
    `;

    const [rows] = await pool.query(query, params);

    let items = rows.map((i) => ({
      ...i,
      TotalAmount: Number(i.Quantity) * Number(i.Price || 0),
    }));

    // SEARCH FILTER
    if (search) {
      const s = search.toLowerCase();

      items = items.filter((i) =>
        `${i.RequisitionNo} ${i.StockName} ${i.Description}`
          .toLowerCase()
          .includes(s),
      );
    }

    // COUNTS
    const counts = {
      ALL: items.length,

      Pending: items.filter((i) => i.StatusName === "Pending").length,

      Accepted: items.filter((i) => i.StatusName === "Accepted").length,

      Rejected: items.filter((i) => i.StatusName === "Rejected").length,
    };

    // STATUS FILTER
    if (status !== "ALL") {
      items = items.filter((i) => i.StatusName === status);
    }

    // GRAND TOTAL
    const grandTotal = items.reduce((sum, i) => sum + i.TotalAmount, 0);

    res.json({
      items,
      counts,
      grandTotal,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// UPDATE REQUESTER ACCOUNT
router.put("/:username", verifyToken, async (req, res) => {
  try {
    const { username } = req.params;

    const { newUsername, firstName, lastName, departmentID } = req.body;

    const adminID = req.user.userId;

    // GET EMPLOYEES
    const [rows] = await pool.query(`
      SELECT
        E.EmployeeID,
        E.UserName,
        E.Firstname,
        E.Lastname,
        E.DepartmentID,
        D.DepartmentName

      FROM Employees E

      LEFT JOIN Departments D
        ON D.DepartmentID = E.DepartmentID
    `);

    const emp = rows.find((e) => decrypt(e.UserName) === username);

    if (!emp) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    const oldUsername = decrypt(emp.UserName);
    const oldFirst = decrypt(emp.Firstname);
    const oldLast = decrypt(emp.Lastname);

    const oldDeptID = emp.DepartmentID;
    const oldDeptName = emp.DepartmentName;

    const logPrefix = `[${oldUsername}] ${oldFirst} ${oldLast}: `;

    // GET NEW DEPARTMENT
    const [deptRows] = await pool.query(
      `
      SELECT DepartmentName
      FROM Departments
      WHERE DepartmentID = ?
    `,
      [departmentID],
    );

    const newDeptName = deptRows[0]?.DepartmentName;

    // UPDATE EMPLOYEE
    await pool.query(
      `
      UPDATE Employees
      SET
        UserName = ?,
        Firstname = ?,
        Lastname = ?,
        DepartmentID = ?,
        ModifiedAt = UTC_TIMESTAMP()

      WHERE EmployeeID = ?
    `,
      [
        encrypt(newUsername),
        encrypt(firstName),
        encrypt(lastName),
        departmentID,
        emp.EmployeeID,
      ],
    );

    const changes = [];

    if (oldUsername !== newUsername) {
      changes.push(
        `${logPrefix}Username changed from ${oldUsername} to ${newUsername}`,
      );
    }

    if (oldFirst !== firstName) {
      changes.push(
        `${logPrefix}Firstname changed from ${oldFirst} to ${firstName}`,
      );
    }

    if (oldLast !== lastName) {
      changes.push(
        `${logPrefix}Lastname changed from ${oldLast} to ${lastName}`,
      );
    }

    if (oldDeptID !== departmentID) {
      changes.push(
        `${logPrefix}Department changed from ${oldDeptName} to ${newDeptName}`,
      );
    }

    // INSERT AUDIT LOGS
    for (const change of changes) {
      await logAudit({
        location: "Requester Account",
        action: "Edit Account",
        adminID,
        details: change,
      });
    }

    res.json({
      message: "Account updated successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// CHANGE PASSWORD
router.put("/:username/password", verifyToken, async (req, res) => {
  try {
    const { username } = req.params;
    const { password } = req.body;

    const adminID = req.user.userId;

    if (!password) {
      return res.status(400).json({
        message: "Password is required",
      });
    }

    // GET EMPLOYEES
    const [rows] = await pool.query(`
      SELECT
        EmployeeID,
        UserName,
        Firstname,
        Lastname
      FROM Employees
    `);

    const emp = rows.find((e) => decrypt(e.UserName) === username);

    if (!emp) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    const oldUsername = decrypt(emp.UserName);
    const oldFirst = decrypt(emp.Firstname);
    const oldLast = decrypt(emp.Lastname);

    const logPrefix = `[${oldUsername}] ${oldFirst} ${oldLast}: `;

    // HASH PASSWORD
    const hashedPassword = await bcrypt.hash(
      password + process.env.BCRYPT_PEPPER,
      12,
    );

    // UPDATE PASSWORD
    await pool.query(
      `
      UPDATE Employees
      SET
        Password = ?,
        ModifiedAt = UTC_TIMESTAMP()

      WHERE EmployeeID = ?
    `,
      [hashedPassword, emp.EmployeeID],
    );

    // AUDIT LOG
    await logAudit({
      location: "Requester Account",
      action: "Change Password",
      adminID,
      details: `${logPrefix}Password was changed`,
    });

    res.json({
      message: "Password updated successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;
