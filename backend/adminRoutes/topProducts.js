// adminRoutes/topProducts.js

const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET TOP PRODUCTS
router.get("/", async (req, res) => {
  try {
    const { year } = req.query;

    let query = `
      SELECT
        S.StockID,
        S.StockCardID,
        S.StockName,
        S.Description,
        S.Price,

        IFNULL((
          SELECT SUM(SI.Quantity)
          FROM StockInvoices SI
          WHERE SI.StockID = S.StockID
        ), 0) AS Quantity,

        -- QUANTITY RELEASED
        IFNULL(SUM(
          CASE
            WHEN R.StatusID = 2
            THEN RD.Quantity
            ELSE 0
          END
        ), 0) AS QuantityReleased,

        -- TOTAL REQUESTS
        COUNT(DISTINCT RD.RequestID) AS TotalRequests,

        -- TOTAL AMOUNT
        IFNULL(SUM(
          CASE
            WHEN R.StatusID = 2
            THEN RD.Quantity * S.Price
            ELSE 0
          END
        ), 0) AS TotalAmount,

        U.UnitName

      FROM Stocks S

      LEFT JOIN RequestDetails RD
        ON S.StockID = RD.StockID

      LEFT JOIN Request R
        ON RD.RequestID = R.RequestID

      LEFT JOIN Units U
        ON S.UnitID = U.UnitID
    `;

    const params = [];

    // YEAR FILTER
    if (year && year !== "ALL") {
      query += ` WHERE YEAR(R.RequestedAt) = ? `;
      params.push(year);
    }

    query += `
      GROUP BY
        S.StockID,
        S.StockCardID,
        S.StockName,
        S.Description,
        S.Price,
        U.UnitName

      HAVING COUNT(DISTINCT RD.RequestID) > 0

      ORDER BY QuantityReleased DESC
    `;

    const [rows] = await pool.execute(query, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// GET YEARS
router.get("/years", async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT YEAR(RequestedAt) AS Year
      FROM Request
      WHERE RequestedAt IS NOT NULL
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

// GET PRODUCT DETAILS
router.get("/details/:stockcard", async (req, res) => {
  try {
    const { stockcard } = req.params;
    const { year } = req.query;

    let summaryQuery = `
      SELECT
        S.StockCardID,
        S.StockName,
        S.Description,
        S.Price,
        U.UnitName,

        -- CURRENT STOCK
        IFNULL((
          SELECT SUM(SI.Quantity)
          FROM StockInvoices SI
          WHERE SI.StockID = S.StockID
        ), 0) AS Quantity,

        -- ACCEPTED QUANTITY
        IFNULL(SUM(
          CASE
            WHEN R.StatusID = 2
            THEN RD.Quantity
            ELSE 0
          END
        ), 0) AS QuantityReleased,

        -- TOTAL REQUESTS
        COUNT(DISTINCT RD.RequestID) AS TotalRequests,

        -- ACCEPTED REQUESTS
        COUNT(DISTINCT CASE
          WHEN R.StatusID = 2
          THEN RD.RequestID
        END) AS AcceptedRequests,

        -- REJECTED REQUESTS
        COUNT(DISTINCT CASE
          WHEN R.StatusID = 3
          THEN RD.RequestID
        END) AS RejectedRequests,

        -- TOTAL AMOUNT
        IFNULL(SUM(
          CASE
            WHEN R.StatusID = 2
            THEN RD.Quantity * S.Price
            ELSE 0
          END
        ), 0) AS TotalAmount

      FROM Stocks S

      LEFT JOIN RequestDetails RD
        ON S.StockID = RD.StockID

      LEFT JOIN Request R
        ON RD.RequestID = R.RequestID

      LEFT JOIN Units U
        ON S.UnitID = U.UnitID

      WHERE S.StockCardID = ?
    `;

    const summaryParams = [stockcard];

    // YEAR FILTER
    if (year && year !== "ALL") {
      summaryQuery += `
        AND YEAR(R.RequestedAt) = ?
      `;

      summaryParams.push(year);
    }

    summaryQuery += `
      GROUP BY
        S.StockID,
        S.StockCardID,
        S.StockName,
        S.Description,
        S.Price,
        U.UnitName
    `;

    const [summaryRows] = await pool.execute(summaryQuery, summaryParams);

    // BREAKDOWN QUERY
    let breakdownQuery = `
      SELECT
        D.DepartmentName,

        COUNT(DISTINCT RD.RequestID) AS TotalRequests,

        SUM(RD.Quantity) AS TotalQuantity,

        SUM(RD.Quantity * S.Price) AS TotalAmount,

        MAX(R.RequestedAt) AS LastRequestDate

      FROM Stocks S

      JOIN RequestDetails RD
        ON S.StockID = RD.StockID

      JOIN Request R
        ON RD.RequestID = R.RequestID

      JOIN Departments D
        ON R.DepartmentID = D.DepartmentID

      WHERE S.StockCardID = ?
      AND R.StatusID = 2
    `;

    const breakdownParams = [stockcard];

    // YEAR FILTER
    if (year && year !== "ALL") {
      breakdownQuery += `
        AND YEAR(R.RequestedAt) = ?
      `;

      breakdownParams.push(year);
    }

    breakdownQuery += `
      GROUP BY D.DepartmentName, S.Price
      ORDER BY TotalQuantity DESC
    `;

    const [breakdownRows] = await pool.execute(breakdownQuery, breakdownParams);

    res.json({
      summary: summaryRows[0],
      breakdown: breakdownRows,
    });
  } catch (err) {
    console.error(err);

    res.status(500).send("Server Error");
  }
});

// GET PRODUCT YEARS
router.get("/details/:stockcard/years", async (req, res) => {
  try {
    const { stockcard } = req.params;

    const [rows] = await pool.execute(
      `
        SELECT DISTINCT YEAR(R.RequestedAt) AS Year

        FROM Stocks S

        JOIN RequestDetails RD
          ON S.StockID = RD.StockID

        JOIN Request R
          ON RD.RequestID = R.RequestID

        WHERE S.StockCardID = ?

        ORDER BY Year DESC
      `,
      [stockcard],
    );

    res.json(rows.map((r) => r.Year));
  } catch (err) {
    console.error(err);

    res.status(500).send("Server Error");
  }
});

module.exports = router;
