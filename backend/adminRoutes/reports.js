const express = require("express");
const router = express.Router();
const pool = require("../db");
const { decrypt } = require("../encryption/crypto");

// GET REPORT OVERVIEW
router.get("/overview", async (req, res) => {
  try {
    const { filter = "monthly", from, to } = req.query;

    let arrivalGroupBy = "";
    let arrivalSelect = "";

    let releaseGroupBy = "";
    let releaseSelect = "";

    // GROUPING LOGIC
    if (filter === "daily") {
      arrivalGroupBy = "DATE(RH.RestockDate)";
      arrivalSelect = "DATE(RH.RestockDate)";

      releaseGroupBy = "DATE(R.ProcessedAt)";
      releaseSelect = "DATE(R.ProcessedAt)";
    } else if (filter === "weekly") {
      arrivalGroupBy = "YEAR(RH.RestockDate), WEEK(RH.RestockDate, 1)";
      arrivalSelect = `CONCAT(YEAR(RH.RestockDate), '-W', LPAD(WEEK(RH.RestockDate,1),2,'0'))`;

      releaseGroupBy = "YEAR(R.ProcessedAt), WEEK(R.ProcessedAt, 1)";
      releaseSelect = `CONCAT(YEAR(R.ProcessedAt), '-W', LPAD(WEEK(R.ProcessedAt,1),2,'0'))`;
    } else if (filter === "monthly") {
      arrivalGroupBy = "DATE_FORMAT(RH.RestockDate, '%Y-%m')";
      arrivalSelect = "DATE_FORMAT(RH.RestockDate, '%Y-%m')";

      releaseGroupBy = "DATE_FORMAT(R.ProcessedAt, '%Y-%m')";
      releaseSelect = "DATE_FORMAT(R.ProcessedAt, '%Y-%m')";
    } else if (filter === "semi-annual") {
      arrivalGroupBy = `YEAR(RH.RestockDate), (CASE WHEN MONTH(RH.RestockDate)<=6 THEN 1 ELSE 2 END)`;
      arrivalSelect = `CONCAT(YEAR(RH.RestockDate), '-H', (CASE WHEN MONTH(RH.RestockDate)<=6 THEN 1 ELSE 2 END))`;

      releaseGroupBy = `YEAR(R.ProcessedAt), (CASE WHEN MONTH(R.ProcessedAt)<=6 THEN 1 ELSE 2 END)`;
      releaseSelect = `CONCAT(YEAR(R.ProcessedAt), '-H', (CASE WHEN MONTH(R.ProcessedAt)<=6 THEN 1 ELSE 2 END))`;
    } else {
      arrivalGroupBy = "YEAR(RH.RestockDate)";
      arrivalSelect = "YEAR(RH.RestockDate)";

      releaseGroupBy = "YEAR(R.ProcessedAt)";
      releaseSelect = "YEAR(R.ProcessedAt)";
    }

    let arrivalWhere = "WHERE 1=1";
    let releaseWhere = "WHERE R.StatusID = 2";

    const params = [];

    if (from && to) {
      arrivalWhere += ` AND RH.RestockDate BETWEEN ? AND ?`;
      releaseWhere += ` AND R.ProcessedAt BETWEEN ? AND ?`;

      // ⚠️ IMPORTANT: multiply params based on usage count
      // Appears 4 TIMES total in query (2 arrival + 2 release)
      params.push(from, to); // A1
      params.push(from, to); // R1
      params.push(from, to); // R2 (UNION)
      params.push(from, to); // A2 (UNION)
    }

    const query = `
      SELECT
        merged.period,
        MAX(merged.ArrivedItems) AS ArrivedItems,
        MAX(merged.ArrivedQty) AS ArrivedQty,
        MAX(merged.ArrivedAmount) AS ArrivedAmount,
        MAX(merged.ReleasedItems) AS ReleasedItems,
        MAX(merged.ReleasedQty) AS ReleasedQty,
        MAX(merged.ReleasedAmount) AS ReleasedAmount

      FROM (
        -- LEFT SIDE
        SELECT
          A.period,
          A.ArrivedItems,
          A.ArrivedQty,
          A.ArrivedAmount,
          COALESCE(R.ReleasedItems,0) AS ReleasedItems,
          COALESCE(R.ReleasedQty,0) AS ReleasedQty,
          COALESCE(R.ReleasedAmount,0) AS ReleasedAmount
        FROM (
          SELECT
            ${arrivalSelect} AS period,
            COUNT(DISTINCT CASE WHEN RH.Quantity > 0 THEN RH.StockID END) AS ArrivedItems,
            SUM(CASE WHEN RH.Quantity > 0 THEN RH.Quantity ELSE 0 END) AS ArrivedQty,
            SUM(CASE WHEN RH.Quantity > 0 THEN RH.Quantity * S.Price ELSE 0 END) AS ArrivedAmount
          FROM RestockHistory RH
          JOIN Stocks S ON RH.StockID = S.StockID
          JOIN Invoices I ON RH.InvoiceID = I.InvoiceID
          ${arrivalWhere}
          GROUP BY ${arrivalGroupBy}
        ) A
        LEFT JOIN (
          SELECT
            ${releaseSelect} AS period,
            COUNT(*) AS ReleasedItems,
            SUM(RDI.Quantity) AS ReleasedQty,
            SUM(RDI.Quantity * S.Price) AS ReleasedAmount
          FROM RequestDetailsInvoice RDI
          JOIN RequestDetails RD ON RDI.RequestDetailsID = RD.RequestDetailsID
          JOIN Request R ON RD.RequestID = R.RequestID
          JOIN Stocks S ON RD.StockID = S.StockID
          ${releaseWhere}
          GROUP BY ${releaseGroupBy}
        ) R
        ON A.period = R.period

        UNION

        -- RIGHT SIDE
        SELECT
          R.period,
          COALESCE(A.ArrivedItems,0),
          COALESCE(A.ArrivedQty,0),
          COALESCE(A.ArrivedAmount,0),
          R.ReleasedItems,
          R.ReleasedQty,
          R.ReleasedAmount
        FROM (
          SELECT
            ${releaseSelect} AS period,
            COUNT(*) AS ReleasedItems,
            SUM(RDI.Quantity) AS ReleasedQty,
            SUM(RDI.Quantity * S.Price) AS ReleasedAmount
          FROM RequestDetailsInvoice RDI
          JOIN RequestDetails RD ON RDI.RequestDetailsID = RD.RequestDetailsID
          JOIN Request R ON RD.RequestID = R.RequestID
          JOIN Stocks S ON RD.StockID = S.StockID
          ${releaseWhere}
          GROUP BY ${releaseGroupBy}
        ) R
        LEFT JOIN (
          SELECT
            ${arrivalSelect} AS period,
            COUNT(DISTINCT CASE WHEN RH.Quantity > 0 THEN RH.StockID END) AS ArrivedItems,
            SUM(CASE WHEN RH.Quantity > 0 THEN RH.Quantity ELSE 0 END) AS ArrivedQty,
            SUM(CASE WHEN RH.Quantity > 0 THEN RH.Quantity * S.Price ELSE 0 END) AS ArrivedAmount
          FROM RestockHistory RH
          JOIN Stocks S ON RH.StockID = S.StockID
          JOIN Invoices I ON RH.InvoiceID = I.InvoiceID
          ${arrivalWhere}
          GROUP BY ${arrivalGroupBy}
        ) A
        ON A.period = R.period

      ) merged
      GROUP BY merged.period
      ORDER BY merged.period
    `;

    const [rows] = await pool.query(query, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// GET RELEASED REQUESTS REPORT
router.get("/requests", async (req, res) => {
  try {
    const { from, to } = req.query;

    let query = `
      SELECT
        R.RequisitionNo,

        E.Firstname,
        E.Lastname,

        D.DepartmentName,

        S.StockName,
        S.Description,

        SUM(RDI.Quantity) AS Quantity,

        U.UnitName,

        SUM(RDI.Quantity * S.Price) AS TotalAmount,

        GROUP_CONCAT(
          CONCAT(I.InvoiceNumber, ' [', RDI.Quantity, ']')
          SEPARATOR ', '
        ) AS InvoiceNumber,

        MAX(R.ProcessedAt) AS ProcessedAt

      FROM RequestDetailsInvoice RDI

      JOIN RequestDetails RD
        ON RDI.RequestDetailsID = RD.RequestDetailsID

      JOIN Request R
        ON RD.RequestID = R.RequestID

      JOIN Stocks S
        ON RD.StockID = S.StockID

      JOIN Units U
        ON S.UnitID = U.UnitID

      JOIN Employees E
        ON R.EmployeeID = E.EmployeeID

      JOIN Departments D
        ON R.DepartmentID = D.DepartmentID

      JOIN StockInvoices SI
        ON RDI.StockInvoiceID = SI.StockInvoiceID

      JOIN Invoices I
        ON SI.InvoiceID = I.InvoiceID

      WHERE R.StatusID = 2
    `;

    const params = [];

    if (from && to) {
      query += `
        AND R.ProcessedAt BETWEEN ? AND ?
      `;

      params.push(from, to);
    }

    query += `
      GROUP BY
        R.RequisitionNo,
        E.Firstname,
        E.Lastname,
        D.DepartmentName,
        S.StockName,
        S.Description,
        U.UnitName

      ORDER BY MAX(R.ProcessedAt) DESC
    `;

    const [rows] = await pool.query(query, params);

    // DECRYPT EMPLOYEE NAMES
    const decryptedData = rows.map((row) => {
      const firstName = decrypt(row.Firstname);
      const lastName = decrypt(row.Lastname);

      return {
        ...row,
        EmployeeName: `${firstName || ""} ${lastName || ""}`.trim(),
      };
    });

    res.json(decryptedData);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// GET ARRIVALS REPORT
router.get("/arrivals", async (req, res) => {
  try {
    const { from, to } = req.query;

    let query = `
      SELECT 
        I.InvoiceNumber,
        S.StockName,
        S.Description,
        -- Use the raw quantity directly from the restock history row
        RH.Quantity AS Quantity, 
        U.UnitName,
        -- Calculate total amount based on the raw quantity and current price
        (RH.Quantity * S.Price) AS TotalAmount,
        RH.RestockDate AS InvoiceDate
      FROM RestockHistory RH
      JOIN Stocks S ON RH.StockID = S.StockID
      JOIN Units U ON S.UnitID = U.UnitID
      JOIN Invoices I ON RH.InvoiceID = I.InvoiceID
      WHERE RH.Quantity > 0
    `;

    const params = [];

    if (from && to) {
      query += ` AND RH.RestockDate BETWEEN ? AND ? `;
      params.push(from, to);
    }

    // Removed GROUP BY to treat every restock entry as its own record
    query += ` ORDER BY RH.RestockDate DESC `;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
