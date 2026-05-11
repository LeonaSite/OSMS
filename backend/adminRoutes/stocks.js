// adminRoutes/stocks.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middleware/auth");
const { logAudit } = require("../utils/auditLogger");
const { decrypt } = require("../encryption/crypto");

// GET ALL STOCKS
router.get("/", async (req, res) => {
  try {
    const { status, type } = req.query;

    let query = `
      SELECT *
      FROM (
        SELECT 
          s.StockID,
          s.StockCardID,
          s.StockName,
          s.Description,
          s.Price,

          IFNULL((
            SELECT SUM(si.Quantity)
            FROM StockInvoices si
            WHERE si.StockID = s.StockID
          ), 0) AS Quantity,

          s.Threshold,
          s.IsArchived,
          s.PriorityID,
          u.UnitName,

          LEFT(s.StockCardID, 2) AS StockType,

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
        LEFT JOIN Units u
          ON s.UnitID = u.UnitID
      ) AS StockData
      WHERE 1=1
    `;

    const params = [];

    // ARCHIVED FILTER
    if (status === "Archived") {
      query += ` AND IsArchived = 1`;
    } else {
      query += ` AND IsArchived = 0`;

      if (status) {
        query += ` AND StockStatus = ?`;
        params.push(status);
      }
    }

    // TYPE FILTER
    if (type) {
      query += ` AND StockType = ?`;
      params.push(type);
    }

    const [rows] = await pool.execute(query, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// SUMMARY
router.get("/summary", async (req, res) => {
  try {
    const query = `
      SELECT

        SUM(
          CASE
            WHEN IsArchived = 1
            THEN 1 ELSE 0
          END
        ) AS ArchivedCount,

        SUM(
          CASE
            WHEN IsArchived = 0
            AND TotalQty = 0
            THEN 1 ELSE 0
          END
        ) AS OutOfStockCount,

        SUM(
          CASE
            WHEN IsArchived = 0
            AND TotalQty > 0
            AND TotalQty <= Threshold
            THEN 1 ELSE 0
          END
        ) AS CriticalCount,

        SUM(
          CASE
            WHEN IsArchived = 0
            AND TotalQty > Threshold
            THEN 1 ELSE 0
          END
        ) AS OnStockCount

      FROM (
        SELECT
          s.StockID,
          s.IsArchived,
          s.Threshold,
          IFNULL(SUM(si.Quantity),0) AS TotalQty
        FROM Stocks s
        LEFT JOIN StockInvoices si
          ON s.StockID = si.StockID
        GROUP BY
          s.StockID,
          s.IsArchived,
          s.Threshold
      ) StockTotals
    `;

    const [rows] = await pool.execute(query);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// TOGGLE ARCHIVE
router.put("/:id/archive", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { isArchived } = req.body;
    const adminID = req.user.userId;

    const [itemRows] = await pool.execute(
      `SELECT StockName, Description FROM Stocks WHERE StockID = ?`,
      [id],
    );

    if (!itemRows.length) {
      return res.status(404).json({
        message: "Stock not found",
      });
    }

    const stock = itemRows[0];

    await pool.execute(
      `
        UPDATE Stocks
        SET IsArchived = ?
        WHERE StockID = ?
      `,
      [isArchived, id],
    );

    await logAudit({
      location: "Stock Control",
      action: isArchived ? "Archived" : "Unarchived",
      adminID,
      details: `${stock.StockName} - ${stock.Description} has been ${
        isArchived ? "Archived" : "Unarchived"
      }.`,
    });

    res.json({
      message: "Updated successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// ADD STOCK
router.post("/", verifyToken, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      stockType,
      stockName,
      description,
      price,
      quantity,
      unitID,
      priorityID,
      threshold,
      invoiceNumber,
    } = req.body;

    const adminID = req.user.userId;

    // CHECK DUPLICATE
    const [duplicate] = await connection.execute(
      `
        SELECT StockID
        FROM Stocks
        WHERE LOWER(StockName) = LOWER(?)
        AND LOWER(Description) = LOWER(?)
      `,
      [stockName, description],
    );

    if (duplicate.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        message: "ITEM_ALREADY_EXISTS",
      });
    }

    // GET LAST STOCK CARD
    const [cardRows] = await connection.execute(
      `
        SELECT StockCardID
        FROM Stocks
        WHERE LEFT(StockCardID, 2) = ?
        ORDER BY StockID DESC
        LIMIT 1
      `,
      [stockType],
    );

    let nextNumber = 1;

    if (cardRows.length > 0) {
      const lastID = cardRows[0].StockCardID;
      nextNumber = parseInt(lastID.slice(2)) + 1;
    }

    const stockCardID = `${stockType}${String(nextNumber).padStart(3, "0")}`;

    // INSERT STOCK
    const [stockInsert] = await connection.execute(
      `
        INSERT INTO Stocks
        (
          StockCardID,
          StockName,
          Description,
          Price,
          UnitID,
          PriorityID,
          Threshold,
          IsArchived
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `,
      [
        stockCardID,
        stockName,
        description,
        price,
        unitID,
        priorityID,
        threshold,
      ],
    );

    const stockID = stockInsert.insertId;

    // ADMIN
    const [adminRows] = await connection.execute(
      `
        SELECT Firstname, Lastname
        FROM Admin
        WHERE AdminID = ?
      `,
      [adminID],
    );

    const admin = adminRows[0];

    const adminName = `${decrypt(admin.Firstname)} ${decrypt(admin.Lastname)}`;

    const invoiceUpper = invoiceNumber.toUpperCase();

    let invoiceID;
    let isNewInvoice = false;

    // CHECK INVOICE
    const [invoiceCheck] = await connection.execute(
      `
        SELECT InvoiceID
        FROM Invoices
        WHERE InvoiceNumber = ?
      `,
      [invoiceUpper],
    );

    if (invoiceCheck.length > 0) {
      invoiceID = invoiceCheck[0].InvoiceID;
    } else {
      isNewInvoice = true;

      const [invoiceInsert] = await connection.execute(
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
        [invoiceUpper, adminID, adminName],
      );

      invoiceID = invoiceInsert.insertId;
    }

    // STOCK INVOICE
    await connection.execute(
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
      [stockID, invoiceID, quantity, adminID, adminName],
    );

    // RESTOCK HISTORY
    await connection.execute(
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
        VALUES (?, ?, ?, UTC_TIMESTAMP(), ?, ?, 'Added')
      `,
      [stockID, invoiceID, quantity, adminID, adminName],
    );

    await connection.commit();

    if (isNewInvoice) {
      await logAudit({
        location: "Stock Invoices",
        action: "Create Invoices",
        adminID,
        details: `#${invoiceUpper} created: add ${quantity} items to ${stockName} - ${description}.`,
      });
    }

    await logAudit({
      location: "Stock Control",
      action: "Create Stock",
      adminID,
      details: `[${stockCardID}] ${stockName} - ${description} created with invoice number #${invoiceUpper}.`,
    });

    res.json({
      message: "Stock added successfully",
      StockCardID: stockCardID,
    });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).send("Insert failed");
  } finally {
    connection.release();
  }
});

router.get("/details/:stockcard", async (req, res) => {
  try {
    const { stockcard } = req.params;

    const [rows] = await pool.execute(
      `
      SELECT 
        s.StockID,
        s.StockCardID,
        s.StockName,
        s.Description,
        s.Price,

        IFNULL(q.TotalQuantity, 0) AS Quantity,
        IFNULL(q.TotalQuantity, 0) * s.Price AS TotalAmount,

        s.Threshold,
        s.IsArchived,
        s.PriorityID,
        s.UnitID,
        s.CreatedAt,
        s.ModifiedAt,
        u.UnitName,

        CASE 
          WHEN IFNULL(q.TotalQuantity,0) = 0 THEN 'OutOfStock'
          WHEN IFNULL(q.TotalQuantity,0) <= s.Threshold THEN 'Critical'
          ELSE 'OnStock'
        END AS StockStatus,

        IFNULL((
          SELECT SUM(rd.Quantity)
          FROM RequestDetails rd
          JOIN Request r ON rd.RequestID = r.RequestID
          WHERE rd.StockID = s.StockID
            AND r.StatusID = 2
        ), 0) AS TotalIssued,

        (
          SELECT MAX(r.ProcessedAt)
          FROM RequestDetailsInvoice rdi
          JOIN RequestDetails rd ON rdi.RequestDetailsID = rd.RequestDetailsID
          JOIN Request r ON rd.RequestID = r.RequestID
          WHERE rd.StockID = s.StockID
            AND r.StatusID = 2
        ) AS LastIssuedDate

      FROM Stocks s

      LEFT JOIN (
        SELECT StockID, SUM(Quantity) AS TotalQuantity
        FROM StockInvoices
        GROUP BY StockID
      ) q ON q.StockID = s.StockID

      LEFT JOIN Units u ON s.UnitID = u.UnitID

      WHERE s.StockCardID = ?
    `,
      [stockcard],
    );

    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const adminID = req.user.userId;
    const { id } = req.params;

    const {
      stockName,
      description,
      price,
      quantity,
      unitID,
      threshold,
      isArchived,
      priorityID,
    } = req.body;

    // 🔹 Get old data
    const [oldRows] = await pool.execute(
      `
      SELECT s.*, u.UnitName
      FROM Stocks s
      LEFT JOIN Units u ON s.UnitID = u.UnitID
      WHERE s.StockID = ?
    `,
      [id],
    );

    const old = oldRows[0];

    // 🔹 Update
    await pool.execute(
      `
      UPDATE Stocks
      SET
        StockName   = ?,
        Description = ?,
        Price       = ?,
        Quantity    = ?,
        UnitID      = ?,
        Threshold   = ?,
        IsArchived  = ?,
        PriorityID  = ?,
        ModifiedAt  = UTC_TIMESTAMP()
      WHERE StockID = ?
    `,
      [
        stockName,
        description,
        price,
        quantity,
        unitID,
        threshold,
        isArchived,
        priorityID,
        id,
      ],
    );

    const changes = [];

    if (old.StockName !== stockName) {
      changes.push(
        `[${old.StockCardID}] ${old.StockName}: name → ${stockName}`,
      );
    }

    if (old.Description !== description) {
      changes.push(`[${old.StockCardID}] desc → ${description}`);
    }

    if (old.Price != price) {
      changes.push(`[${old.StockCardID}] price ${old.Price} → ${price}`);
    }

    if (old.Threshold != threshold) {
      changes.push(
        `[${old.StockCardID}] threshold ${old.Threshold} → ${threshold}`,
      );
    }

    if (old.PriorityID != priorityID) {
      changes.push(
        `[${old.StockCardID}] priority ${old.PriorityID} → ${priorityID}`,
      );
    }

    if (old.UnitID != unitID) {
      const [unitRows] = await pool.execute(
        `SELECT UnitName FROM Units WHERE UnitID = ?`,
        [unitID],
      );

      changes.push(
        `[${old.StockCardID}] unit ${old.UnitName} → ${unitRows[0]?.UnitName}`,
      );
    }

    for (const change of changes) {
      await logAudit({
        location: "Stock Control",
        action: "Edit Stock",
        adminID,
        details: change,
      });
    }

    // archive toggle
    if (old.IsArchived != isArchived) {
      await logAudit({
        location: "Stock Control",
        action: isArchived ? "Archived" : "Unarchived",
        adminID,
        details: `[${old.StockCardID}] ${isArchived ? "Archived" : "Unarchived"}`,
      });
    }

    res.json({ message: "Stock updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.put("/:id/change-type", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { stockType } = req.body;
    const adminID = req.user.userId;

    // 1️⃣ Get current
    const [rows] = await pool.execute(
      `
      SELECT StockCardID
      FROM Stocks
      WHERE StockID = ?
    `,
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Stock not found" });
    }

    const currentStockCardID = rows[0].StockCardID;
    const currentType = currentStockCardID.substring(0, 2);

    if (currentType === stockType) {
      return res.json({ message: "Stock type unchanged" });
    }

    // 2️⃣ Get existing IDs
    const [existing] = await pool.execute(
      `
      SELECT StockCardID
      FROM Stocks
      WHERE StockCardID LIKE CONCAT(?, '%')
    `,
      [stockType],
    );

    const numbers = existing.map((row) =>
      parseInt(row.StockCardID.substring(2)),
    );

    let nextNumber = 1;
    while (numbers.includes(nextNumber)) {
      nextNumber++;
    }

    const formattedNumber = String(nextNumber).padStart(3, "0");
    const newStockCardID = `${stockType}${formattedNumber}`;

    // 3️⃣ Update
    await pool.execute(
      `
      UPDATE Stocks
      SET
        StockCardID = ?,
        ModifiedAt = UTC_TIMESTAMP()
      WHERE StockID = ?
    `,
      [newStockCardID, id],
    );

    await logAudit({
      location: "Stock Control",
      action: "Edit Stock",
      adminID,
      details: `[${currentStockCardID}] → ${newStockCardID}`,
    });

    res.json({
      message: "Stock type updated",
      newStockCardID,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// RESTOCK
router.post("/:id/restock", verifyToken, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const { quantity, invoiceNumber } = req.body;

    let isNewInvoice = false;

    if (!quantity || quantity <= 0 || !invoiceNumber) {
      return res.status(400).json({
        message: "Invalid input",
      });
    }

    await connection.beginTransaction();

    const adminID = req.user.userId;

    // GET ADMIN
    const [adminRows] = await connection.execute(
      `
        SELECT Firstname, Lastname
        FROM Admin
        WHERE AdminID = ?
      `,
      [adminID],
    );

    if (!adminRows.length) {
      throw new Error("Admin not found");
    }

    const admin = adminRows[0];

    const adminName = `${decrypt(admin.Firstname)} ${decrypt(admin.Lastname)}`;

    const invoiceUpper = invoiceNumber.toUpperCase();

    // CHECK INVOICE
    const [invoiceCheck] = await connection.execute(
      `
        SELECT InvoiceID
        FROM Invoices
        WHERE InvoiceNumber = ?
      `,
      [invoiceUpper],
    );

    let invoiceID;

    if (invoiceCheck.length > 0) {
      invoiceID = invoiceCheck[0].InvoiceID;
    } else {
      isNewInvoice = true;

      const [invoiceInsert] = await connection.execute(
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
        [invoiceUpper, adminID, adminName],
      );

      invoiceID = invoiceInsert.insertId;
    }

    // CHECK STOCK INVOICE
    const [stockInvoiceCheck] = await connection.execute(
      `
        SELECT *
        FROM StockInvoices
        WHERE StockID = ?
        AND InvoiceID = ?
      `,
      [id, invoiceID],
    );

    if (stockInvoiceCheck.length > 0) {
      // UPDATE EXISTING
      await connection.execute(
        `
          UPDATE StockInvoices
          SET
            Quantity = Quantity + ?,
            InvoiceDate = UTC_TIMESTAMP()
          WHERE StockID = ?
          AND InvoiceID = ?
        `,
        [quantity, id, invoiceID],
      );
    } else {
      // INSERT NEW
      await connection.execute(
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
        [id, invoiceID, quantity, adminID, adminName],
      );
    }

    // INSERT HISTORY
    await connection.execute(
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
        VALUES (?, ?, ?, UTC_TIMESTAMP(), ?, ?, 'Added')
      `,
      [id, invoiceID, quantity, adminID, adminName],
    );

    // STOCK INFO
    const [stockRows] = await connection.execute(
      `
        SELECT StockName, Description
        FROM Stocks
        WHERE StockID = ?
      `,
      [id],
    );

    const stock = stockRows[0];

    // AUDIT NEW INVOICE
    if (isNewInvoice) {
      await logAudit({
        location: "Stock Invoices",
        action: "Create Invoices",
        adminID,
        details: `#${invoiceUpper} created: add ${quantity} items to ${stock.StockName} - ${stock.Description}.`,
      });
    }

    // AUDIT RESTOCK
    await logAudit({
      location: "Stock Control",
      action: "Restock",
      adminID,
      details: `Added ${quantity} items to ${stock.StockName} - ${stock.Description} from invoice #${invoiceUpper}.`,
    });

    await connection.commit();

    res.json({
      message: "Stock restocked successfully",
    });
  } catch (err) {
    await connection.rollback();

    console.error(err);

    res.status(500).json({
      message: "Server Error",
    });
  } finally {
    connection.release();
  }
});

// RESTOCK HISTORY
router.get("/:id/restock-history", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    let query = `
      SELECT
        rh.RestockID,
        rh.StockID,
        rh.InvoiceID,
        rh.Quantity,
        rh.Action,
        rh.RestockDate,
        rh.AdminName,
        i.InvoiceNumber
      FROM RestockHistory rh
      LEFT JOIN Invoices i
        ON rh.InvoiceID = i.InvoiceID
      WHERE rh.StockID = ?
    `;

    const params = [id];

    if (startDate && endDate) {
      query += `
        AND DATE(rh.RestockDate)
        BETWEEN ? AND ?
      `;

      params.push(startDate, endDate);
    }

    query += ` ORDER BY rh.RestockDate DESC`;

    const [rows] = await pool.execute(query, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// GET STOCK INVOICES
router.get("/:stockID/invoices", async (req, res) => {
  try {
    const { stockID } = req.params;

    const [rows] = await pool.execute(
      `
        SELECT
          si.StockInvoiceID,
          si.Quantity,
          s.Price,
          (si.Quantity * s.Price) AS TotalAmount,
          si.InvoiceDate,
          i.InvoiceNumber
        FROM StockInvoices si
        JOIN Invoices i
          ON si.InvoiceID = i.InvoiceID
        JOIN Stocks s
          ON si.StockID = s.StockID
        WHERE si.StockID = ?
        ORDER BY si.InvoiceDate DESC
      `,
      [stockID],
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// UPDATE STOCK INVOICE
router.put("/invoices/:stockInvoiceID", verifyToken, async (req, res) => {
  try {
    const { stockInvoiceID } = req.params;
    const { quantity } = req.body;

    if (quantity < 0) {
      return res.status(400).json({
        message: "Quantity cannot be negative",
      });
    }

    const adminID = req.user.userId;

    // ADMIN
    const [adminRows] = await pool.execute(
      `
        SELECT Firstname, Lastname
        FROM Admin
        WHERE AdminID = ?
      `,
      [adminID],
    );

    if (!adminRows.length) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    const admin = adminRows[0];

    const adminName = `${decrypt(admin.Firstname)} ${decrypt(admin.Lastname)}`;

    // EXISTING INVOICE
    const [existingRows] = await pool.execute(
      `
        SELECT StockID, InvoiceID, Quantity
        FROM StockInvoices
        WHERE StockInvoiceID = ?
      `,
      [stockInvoiceID],
    );

    if (!existingRows.length) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    const row = existingRows[0];

    const oldQty = row.Quantity;
    const diff = quantity - oldQty;

    // STOCK INFO
    const [stockRows] = await pool.execute(
      `
        SELECT StockCardID, StockName, Description
        FROM Stocks
        WHERE StockID = ?
      `,
      [row.StockID],
    );

    // INVOICE INFO
    const [invoiceRows] = await pool.execute(
      `
        SELECT InvoiceNumber
        FROM Invoices
        WHERE InvoiceID = ?
      `,
      [row.InvoiceID],
    );

    const stock = stockRows[0];
    const invoice = invoiceRows[0];

    // UPDATE INVOICE
    await pool.execute(
      `
        UPDATE StockInvoices
        SET Quantity = ?
        WHERE StockInvoiceID = ?
      `,
      [quantity, stockInvoiceID],
    );

    // INSERT HISTORY
    const action = diff > 0 ? "Added [Edit]" : "Removed [Edit]";

    await pool.execute(
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
        VALUES (?, ?, ?, UTC_TIMESTAMP(), ?, ?, ?)
      `,
      [row.StockID, row.InvoiceID, diff, adminID, adminName, action],
    );

    // AUDIT
    await logAudit({
      location: "Stock Invoices",
      action: "Edit Invoices",
      adminID,
      details: `Edit [${stock.StockCardID}] ${stock.StockName} - ${stock.Description}: #${invoice.InvoiceNumber} quantity ${oldQty} to ${quantity}.`,
    });

    res.json({
      message: "Invoice updated successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// REQUEST YEARS
router.get("/reqyears", async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT Year
      FROM (
        SELECT YEAR(R.RequestedAt) AS Year
        FROM Request R
        WHERE R.RequestedAt IS NOT NULL

        UNION

        SELECT YEAR(R.ProcessedAt) AS Year
        FROM Request R
        WHERE R.ProcessedAt IS NOT NULL
      ) AS Years
      ORDER BY Year DESC
    `);

    res.json(rows.map((r) => r.Year));
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// PRODUCT REQUESTS
router.get("/:stockID/requests", async (req, res) => {
  try {
    const { stockID } = req.params;

    const { status = "Accepted", search = "", year = "ALL" } = req.query;

    let query = `
      SELECT
        R.RequestID,
        R.RequisitionNo,
        R.RequestedAt,
        R.ProcessedAt,

        RD.RequestDetailsID,
        RD.Quantity,

        S.StatusName,

        ST.StockName,
        ST.Price,

        E.Firstname,
        E.Lastname,

        D.DepartmentName

      FROM RequestDetails RD

      JOIN Request R
        ON R.RequestID = RD.RequestID

      JOIN Stocks ST
        ON ST.StockID = RD.StockID

      JOIN Status S
        ON S.StatusID = R.StatusID

      JOIN Employees E
        ON E.EmployeeID = R.EmployeeID

      LEFT JOIN Departments D
        ON D.DepartmentID = E.DepartmentID

      WHERE RD.StockID = ?
    `;

    const params = [stockID];

    if (year !== "ALL") {
      query += `
        AND (
          YEAR(R.RequestedAt) = ?
          OR YEAR(R.ProcessedAt) = ?
        )
      `;

      params.push(Number(year), Number(year));
    }

    query += ` ORDER BY R.RequestedAt DESC`;

    const [rows] = await pool.execute(query, params);

    let items = rows.map((item) => ({
      ...item,
      RequesterName: `${decrypt(item.Firstname)} ${decrypt(item.Lastname)}`,
      TotalAmount: Number(item.Quantity) * Number(item.Price || 0),
    }));

    // SEARCH
    if (search) {
      const s = search.toLowerCase();

      items = items.filter((i) =>
        `
          ${i.RequisitionNo}
          ${i.RequesterName}
          ${i.DepartmentName || ""}
        `
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

    res.json({
      items,
      counts,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;
