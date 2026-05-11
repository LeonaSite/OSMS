const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const pool = require("../db");

// ✅ 1. Pending Requests Summary
router.get("/pending-requests-summary", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) AS totalPending,
        MIN(RequestedAt) AS firstPendingDate
      FROM Request
      WHERE StatusID = 1
    `);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// ✅ 2. Top Items
router.get("/top-items", async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const { year = currentYear } = req.query;

    let query = `
      SELECT 
        S.StockName,
        S.Description,
        SUM(CASE 
          WHEN R.StatusID = 2 
          THEN RD.Quantity 
          ELSE 0 
        END) AS QuantityReleased
      FROM Stocks S
      LEFT JOIN RequestDetails RD ON S.StockID = RD.StockID
      LEFT JOIN Request R ON RD.RequestID = R.RequestID
    `;

    let params = [];

    if (year !== "ALL") {
      query += ` WHERE YEAR(R.RequestedAt) = ?`;
      params.push(parseInt(year));
    }

    query += `
      GROUP BY S.StockName, S.Description
      HAVING QuantityReleased > 0
      ORDER BY QuantityReleased DESC
      LIMIT 5
    `;

    const [rows] = await pool.query(query, params);

    const cleaned = rows.map((item) => ({
      name: item.StockName,
      description: item.Description,
    }));

    res.json(cleaned);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// ✅ 3. Low Stock
router.get("/low-stock", async (req, res) => {
  try {
    // RESULT 1
    const [items] = await pool.query(`
      SELECT 
        s.StockID,
        s.StockName,
        s.Description,
        s.Threshold,
        u.UnitName,

        IFNULL((
          SELECT SUM(si.Quantity)
          FROM StockInvoices si
          WHERE si.StockID = s.StockID
        ),0) AS Quantity,

        CASE 
          WHEN IFNULL((
            SELECT SUM(si.Quantity)
            FROM StockInvoices si
            WHERE si.StockID = s.StockID
          ),0) = 0 THEN 'OutOfStock'

          WHEN IFNULL((
            SELECT SUM(si.Quantity)
            FROM StockInvoices si
            WHERE si.StockID = s.StockID
          ),0) <= s.Threshold THEN 'Critical'

          ELSE 'OnStock'
        END AS StockStatus

      FROM Stocks s
      LEFT JOIN Units u ON s.UnitID = u.UnitID
      WHERE (s.IsArchived = 0 OR s.IsArchived IS NULL)
      HAVING StockStatus IN ('OutOfStock','Critical')
      ORDER BY Quantity ASC, Threshold ASC
      LIMIT 8
    `);

    // RESULT 2
    const [summaryRows] = await pool.query(`
      SELECT
        COUNT(*) AS total,

        SUM(CASE WHEN TotalQty = 0 THEN 1 ELSE 0 END) AS outOfStock,

        SUM(CASE 
          WHEN TotalQty > 0 AND TotalQty <= Threshold THEN 1 
          ELSE 0 
        END) AS critical

      FROM (
        SELECT
          s.StockID,
          s.Threshold,

          IFNULL((
            SELECT SUM(si.Quantity)
            FROM StockInvoices si
            WHERE si.StockID = s.StockID
          ),0) AS TotalQty

        FROM Stocks s
        WHERE (s.IsArchived = 0 OR s.IsArchived IS NULL)
      ) AS Computed
    `);

    res.json({
      items,
      summary: summaryRows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// ✅ 4. Top Divisions
router.get("/top-divisions", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        D.DepartmentID,
        D.DepartmentName,

        COUNT(CASE WHEN R.StatusID = 2 THEN RD.RequestDetailsID END) AS TotalIssued,

        SUM(CASE 
          WHEN R.StatusID = 2 THEN RD.Quantity
          ELSE 0
        END) AS Quantity,

        SUM(CASE 
          WHEN R.StatusID = 2 THEN RD.Quantity * S.Price
          ELSE 0
        END) AS TotalAmount

      FROM Departments D
      LEFT JOIN Employees E ON D.DepartmentID = E.DepartmentID
      LEFT JOIN Request R ON E.EmployeeID = R.EmployeeID
      LEFT JOIN RequestDetails RD ON R.RequestID = RD.RequestID
      LEFT JOIN Stocks S ON RD.StockID = S.StockID

      GROUP BY D.DepartmentID, D.DepartmentName
      HAVING Quantity > 0
      ORDER BY TotalAmount DESC
      LIMIT 3
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to fetch top divisions",
    });
  }
});

module.exports = router;
