const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middleware/auth");
const { logAudit } = require("../utils/auditLogger");
const { decrypt } = require("../encryption/crypto");

// GET ALL INVOICES
router.get("/", async (req, res) => {
  try {
    const { status, from, to } = req.query;

    let query = `
      SELECT 
        i.InvoiceID,
        i.InvoiceNumber,
        i.InvoiceDate,
        i.AdminID,
        i.AdminName,

        COUNT(si.StockID) AS StockItems,

        COALESCE(SUM(si.Quantity), 0) AS Quantity,

        COALESCE(SUM(si.Quantity * s.Price), 0) AS TotalAmount

      FROM Invoices i

      LEFT JOIN StockInvoices si
        ON i.InvoiceID = si.InvoiceID

      LEFT JOIN Stocks s
        ON si.StockID = s.StockID

      WHERE 1=1
    `;

    const params = [];

    if (from && to) {
      query += ` AND DATE(i.InvoiceDate) BETWEEN ? AND ? `;
      params.push(from, to);
    }

    query += `
      GROUP BY
        i.InvoiceID,
        i.InvoiceNumber,
        i.InvoiceDate,
        i.AdminID,
        i.AdminName
    `;

    if (status && status !== "All") {
      if (status === "Active") {
        query += ` HAVING COALESCE(SUM(si.Quantity), 0) > 0 `;
      }

      if (status === "Empty") {
        query += ` HAVING COALESCE(SUM(si.Quantity), 0) = 0 `;
      }
    }

    query += ` ORDER BY i.InvoiceDate DESC `;

    const [rows] = await pool.query(query, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// GET INVOICE DETAILS
router.get("/details/:invoiceNo", async (req, res) => {
  try {
    const { invoiceNo } = req.params;

    const [invoiceRows] = await pool.query(
      `
      SELECT
        InvoiceID,
        InvoiceNumber,
        InvoiceDate
      FROM Invoices
      WHERE InvoiceNumber = ?
    `,
      [invoiceNo],
    );

    if (!invoiceRows.length) {
      return res.status(404).send("Invoice not found");
    }

    const invoice = invoiceRows[0];

    const [stocks] = await pool.query(
      `
      SELECT
        si.StockInvoiceID,
        s.StockCardID,
        s.StockName,
        s.Description,
        s.Price,
        si.Quantity,

        (si.Quantity * s.Price) AS TotalAmount

      FROM StockInvoices si

      JOIN Stocks s
        ON si.StockID = s.StockID

      WHERE si.InvoiceID = ?

      ORDER BY s.StockCardID
    `,
      [invoice.InvoiceID],
    );

    const [totalRows] = await pool.query(
      `
      SELECT
        COALESCE(SUM(si.Quantity * s.Price), 0) AS GrandTotal

      FROM StockInvoices si

      JOIN Stocks s
        ON si.StockID = s.StockID

      WHERE si.InvoiceID = ?
    `,
      [invoice.InvoiceID],
    );

    res.json({
      invoice,
      stocks,
      grandTotal: totalRows[0].GrandTotal,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// GET RESTOCK HISTORY
router.get("/:invoiceID/restock-history", async (req, res) => {
  try {
    const { invoiceID } = req.params;
    const { startDate, endDate } = req.query;

    let query = `
      SELECT
        rh.RestockID,
        rh.Quantity,
        rh.Action,
        rh.RestockDate,
        rh.AdminName,

        s.StockName,
        s.Description

      FROM RestockHistory rh

      JOIN Stocks s
        ON rh.StockID = s.StockID

      WHERE rh.InvoiceID = ?
    `;

    const params = [invoiceID];

    if (startDate && endDate) {
      query += `
        AND DATE(rh.RestockDate)
        BETWEEN ? AND ?
      `;

      params.push(startDate, endDate);
    }

    query += `
      ORDER BY rh.RestockDate DESC
    `;

    const [rows] = await pool.query(query, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// UPDATE STOCK INVOICE QUANTITY
router.put("/update-quantity/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    const adminID = req.user.userId;

    // GET ADMIN
    const [adminRows] = await pool.query(
      `
      SELECT Firstname, Lastname
      FROM Admin
      WHERE AdminID = ?
    `,
      [adminID],
    );

    if (!adminRows.length) {
      return res.status(404).send("Admin not found");
    }

    const admin = adminRows[0];

    const firstName = decrypt(admin.Firstname);
    const lastName = decrypt(admin.Lastname);

    const adminName = `${firstName} ${lastName}`;

    // GET EXISTING STOCK INVOICE
    const [existingRows] = await pool.query(
      `
      SELECT
        StockID,
        InvoiceID,
        Quantity

      FROM StockInvoices

      WHERE StockInvoiceID = ?
    `,
      [id],
    );

    if (!existingRows.length) {
      return res.status(404).send("Invoice item not found");
    }

    const row = existingRows[0];

    const oldQty = row.Quantity;
    const diff = quantity - oldQty;

    // GET STOCK INFO
    const [stockRows] = await pool.query(
      `
      SELECT
        StockCardID,
        StockName,
        Description

      FROM Stocks

      WHERE StockID = ?
    `,
      [row.StockID],
    );

    // GET INVOICE INFO
    const [invoiceRows] = await pool.query(
      `
      SELECT
        InvoiceNumber

      FROM Invoices

      WHERE InvoiceID = ?
    `,
      [row.InvoiceID],
    );

    const stock = stockRows[0];
    const invoice = invoiceRows[0];

    // UPDATE STOCK INVOICE
    await pool.query(
      `
      UPDATE StockInvoices
      SET Quantity = ?
      WHERE StockInvoiceID = ?
    `,
      [quantity, id],
    );

    // UPDATE STOCK QUANTITY
    await pool.query(
      `
      UPDATE Stocks
      SET Quantity = Quantity + ?
      WHERE StockID = ?
    `,
      [diff, row.StockID],
    );

    const action = diff > 0 ? "Added [Edit]" : "Removed [Edit]";

    // INSERT RESTOCK HISTORY
    await pool.query(
      `
      INSERT INTO RestockHistory
      (
        StockID,
        InvoiceID,
        Quantity,
        RestockDate,
        AdminID,
        AdminName,
        Action
      )
      VALUES
      (?, ?, ?, UTC_TIMESTAMP(), ?, ?, ?)
    `,
      [row.StockID, row.InvoiceID, diff, adminID, adminName, action],
    );

    await logAudit({
      location: "Stock Invoices",
      action: "Edit Invoices",
      adminID,
      details: `Edit [${stock.StockCardID}] ${stock.StockName} - ${stock.Description}: #${invoice.InvoiceNumber} quantity ${oldQty} to ${quantity}.`,
    });

    res.send("Updated");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating quantity");
  }
});

// CREATE OR RESTOCK INVOICE
router.post("/create", verifyToken, async (req, res) => {
  try {
    const { invoiceNumber, items } = req.body;

    let isNewInvoice = false;

    const adminID = req.user.userId;

    // GET ADMIN
    const [adminRows] = await pool.query(
      `
      SELECT
        Firstname,
        Lastname

      FROM Admin

      WHERE AdminID = ?
    `,
      [adminID],
    );

    if (!adminRows.length) {
      return res.status(404).send("Admin not found");
    }

    const admin = adminRows[0];

    const firstName = decrypt(admin.Firstname);
    const lastName = decrypt(admin.Lastname);

    const adminName = `${firstName} ${lastName}`;

    const formattedInvoice = invoiceNumber.toUpperCase();

    // CHECK IF INVOICE EXISTS
    const [invoiceCheck] = await pool.query(
      `
      SELECT InvoiceID
      FROM Invoices
      WHERE InvoiceNumber = ?
    `,
      [formattedInvoice],
    );

    let invoiceID;

    // USE EXISTING INVOICE
    if (invoiceCheck.length > 0) {
      invoiceID = invoiceCheck[0].InvoiceID;
    } else {
      isNewInvoice = true;

      // CREATE NEW INVOICE
      const [invoiceResult] = await pool.query(
        `
        INSERT INTO Invoices
        (
          InvoiceNumber,
          InvoiceDate,
          AdminID,
          AdminName
        )
        VALUES (?, UTC_TIMESTAMP(), ?, ?)
      `,
        [formattedInvoice, adminID, adminName],
      );

      invoiceID = invoiceResult.insertId;
    }

    const auditDetails = [];

    // INSERT ITEMS
    for (const item of items) {
      // INSERT STOCK INVOICE
      await pool.query(
        `
        INSERT INTO StockInvoices
        (
          StockID,
          InvoiceID,
          Quantity,
          InvoiceDate,
          AdminID,
          AdminName
        )
        VALUES (?, ?, ?, UTC_TIMESTAMP(), ?, ?)
      `,
        [item.StockID, invoiceID, item.Quantity, adminID, adminName],
      );

      // UPDATE STOCK QUANTITY
      await pool.query(
        `
        UPDATE Stocks
        SET Quantity = Quantity + ?
        WHERE StockID = ?
      `,
        [item.Quantity, item.StockID],
      );

      // INSERT RESTOCK HISTORY
      await pool.query(
        `
        INSERT INTO RestockHistory
        (
          StockID,
          InvoiceID,
          Quantity,
          RestockDate,
          AdminID,
          AdminName,
          Action
        )
        VALUES
        (?, ?, ?, UTC_TIMESTAMP(), ?, ?, 'Added')
      `,
        [item.StockID, invoiceID, item.Quantity, adminID, adminName],
      );

      // GET STOCK INFO
      const [stockRows] = await pool.query(
        `
        SELECT
          StockName,
          Description

        FROM Stocks

        WHERE StockID = ?
      `,
        [item.StockID],
      );

      const stock = stockRows[0];

      auditDetails.push(
        `add ${item.Quantity} items to ${stock.StockName} - ${stock.Description}`,
      );
    }

    const finalDetails = `#${formattedInvoice} ${
      isNewInvoice ? "created" : "restocked"
    }: ${auditDetails.join(", ")}.`;

    await logAudit({
      location: "Stock Invoices",
      action: isNewInvoice ? "Create Invoices" : "Restock",
      adminID,
      details: finalDetails,
    });

    res.send("Invoice processed");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

module.exports = router;
