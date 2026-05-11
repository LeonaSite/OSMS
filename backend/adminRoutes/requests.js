const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middleware/auth");
const { decrypt } = require("../encryption/crypto");
const { logAudit } = require("../utils/auditLogger");

// GET ALL REQUESTS
router.get("/", async (req, res) => {
  try {
    const [result] = await pool.query(`
      SELECT
          R.RequestID,
          R.RequisitionNo,
          R.EmployeeID,
          R.RequestedAt,
          R.ProcessedAt,
          S.StatusName,

          E.Firstname,
          E.Lastname,

          D.DepartmentName,

          COUNT(RD.RequestDetailsID) AS ItemCount,
          IFNULL(SUM(RD.Quantity), 0) AS TotalQuantity,

          IFNULL(SUM(RD.Quantity * ST.Price), 0) AS TotalAmount

      FROM Request R

      JOIN Employees E
        ON R.EmployeeID = E.EmployeeID

      JOIN Departments D
        ON R.DepartmentID = D.DepartmentID

      JOIN Status S
        ON R.StatusID = S.StatusID

      LEFT JOIN RequestDetails RD
        ON R.RequestID = RD.RequestID

      LEFT JOIN Stocks ST
        ON RD.StockID = ST.StockID

      GROUP BY
          R.RequestID,
          R.RequisitionNo,
          R.EmployeeID,
          R.RequestedAt,
          R.ProcessedAt,
          S.StatusName,
          E.Firstname,
          E.Lastname,
          D.DepartmentName

      ORDER BY R.RequestedAt DESC
    `);

    const requests = result.map((r) => ({
      ...r,
      Firstname: decrypt(r.Firstname),
      Lastname: decrypt(r.Lastname),
    }));

    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// CREATE REQUEST
router.post("/create", verifyToken, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { EmployeeID, items, Purpose } = req.body;

    const finalPurpose = Purpose?.trim()
      ? Purpose
      : "Need supplies at the office.";

    const modifiedBy = req.user?.username || "Unknown";

    // VALIDATION
    if (!EmployeeID) {
      return res.status(400).send("EmployeeID is required");
    }

    if (!items || items.length === 0) {
      return res.status(400).send("No items selected");
    }

    for (const item of items) {
      if (!item.StockID || !item.Quantity || item.Quantity <= 0) {
        return res.status(400).send("Invalid item data");
      }
    }

    // GET EMPLOYEE DEPARTMENT
    const [emp] = await connection.query(
      `
      SELECT DepartmentID
      FROM Employees
      WHERE EmployeeID = ?
      `,
      [EmployeeID],
    );

    if (!emp.length) {
      return res.status(404).send("Employee not found");
    }

    const departmentID = emp[0].DepartmentID;

    // GENERATE UNIQUE REQUISITION NUMBER
    let requisitionNo;
    let exists = true;

    while (exists) {
      requisitionNo = Math.floor(100000 + Math.random() * 900000);

      const [check] = await connection.query(
        `
        SELECT RequisitionNo
        FROM Request
        WHERE RequisitionNo = ?
        `,
        [requisitionNo],
      );

      exists = check.length > 0;
    }

    // START TRANSACTION
    await connection.beginTransaction();

    // INSERT REQUEST
    const [requestInsert] = await connection.query(
      `
      INSERT INTO Request
      (
        RequisitionNo,
        DepartmentID,
        EmployeeID,
        RequestedAt,
        StatusID,
        Purpose
      )
      VALUES (?, ?, ?, UTC_TIMESTAMP(), 1, ?)
      `,
      [requisitionNo, departmentID, EmployeeID, finalPurpose],
    );

    const requestID = requestInsert.insertId;

    // INSERT REQUEST ITEMS + HISTORY
    for (const item of items) {
      // INSERT REQUEST DETAILS
      const [insertResult] = await connection.query(
        `
        INSERT INTO RequestDetails
        (
          RequestID,
          StockID,
          Quantity
        )
        VALUES (?, ?, ?)
        `,
        [requestID, item.StockID, item.Quantity],
      );

      const requestDetailsID = insertResult.insertId;

      // INSERT HISTORY
      await connection.query(
        `
        INSERT INTO RequestDetailsHistory
        (
          RequestDetailsID,
          RequestID,
          StockID,
          OldQuantity,
          NewQuantity,
          Action,
          ModifiedAt,
          ModifiedBy
        )
        VALUES (?, ?, ?, ?, ?, 'Created', UTC_TIMESTAMP(), ?)
        `,
        [
          requestDetailsID,
          requestID,
          item.StockID,
          0,
          item.Quantity,
          modifiedBy,
        ],
      );
    }

    // GET EMPLOYEE INFO
    const [empInfo] = await connection.query(
      `
      SELECT
          e.Firstname,
          e.Lastname,
          d.DepartmentName
      FROM Employees e
      JOIN Departments d
        ON e.DepartmentID = d.DepartmentID
      WHERE e.EmployeeID = ?
      `,
      [EmployeeID],
    );

    const empRaw = empInfo[0];

    const empData = {
      Firstname: decrypt(empRaw.Firstname),
      Lastname: decrypt(empRaw.Lastname),
      DepartmentName: empRaw.DepartmentName,
    };

    // BUILD ITEM DETAILS
    const itemDetails = [];

    for (const item of items) {
      const [stockInfo] = await connection.query(
        `
        SELECT
            s.StockName,
            s.Description,
            u.UnitName
        FROM Stocks s
        JOIN Units u
          ON s.UnitID = u.UnitID
        WHERE s.StockID = ?
        `,
        [item.StockID],
      );

      const stock = stockInfo[0];

      itemDetails.push(
        `${item.Quantity} ${stock.UnitName} of ${stock.StockName} - ${stock.Description}`,
      );
    }

    // AUDIT LOG
    await logAudit({
      connection,
      location: "Requisition Control",
      action: "Create Request",
      adminID: req.user.userId,
      details: `[#${requisitionNo}] Requested by ${empData.Firstname} ${empData.Lastname} [${empData.DepartmentName}] for: ${itemDetails.join(", ")}`,
    });

    // COMMIT
    await connection.commit();

    res.send({
      message: "Request created",
      RequisitionNo: requisitionNo,
    });
  } catch (err) {
    await connection.rollback();

    console.error(err);
    res.status(500).send(err.message);
  } finally {
    connection.release();
  }
});

// EMPLOYEE SELECTOR
router.get("/employee-selector", async (req, res) => {
  try {
    const search = req.query.search || "";
    const department = req.query.department || "ALL";
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    const offset = (page - 1) * pageSize;

    const [result] = await pool.query(
      `
      SELECT
          E.EmployeeID,
          E.Firstname,
          E.Lastname,
          E.UserName,
          D.DepartmentName

      FROM Employees E

      JOIN Departments D
        ON E.DepartmentID = D.DepartmentID

      WHERE
        (
          E.UserName LIKE ?
          OR E.Firstname LIKE ?
          OR E.Lastname LIKE ?
          OR D.DepartmentName LIKE ?
        )
        AND (? = 'ALL' OR D.DepartmentName = ?)

      ORDER BY E.UserName
      LIMIT ? OFFSET ?
      `,
      [
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        department,
        department,
        pageSize,
        offset,
      ],
    );

    // TOTAL COUNT
    const [countResult] = await pool.query(
      `
      SELECT COUNT(*) AS total

      FROM Employees E

      JOIN Departments D
        ON E.DepartmentID = D.DepartmentID

      WHERE
        (
          E.UserName LIKE ?
          OR E.Firstname LIKE ?
          OR E.Lastname LIKE ?
          OR D.DepartmentName LIKE ?
        )
        AND (? = 'ALL' OR D.DepartmentName = ?)
      `,
      [
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        department,
        department,
      ],
    );

    const employees = result.map((emp) => ({
      EmployeeID: emp.EmployeeID,
      Firstname: decrypt(emp.Firstname),
      Lastname: decrypt(emp.Lastname),
      Username: decrypt(emp.UserName),
      DepartmentName: emp.DepartmentName,
    }));

    res.json({
      data: employees,
      total: countResult[0].total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// GET DEPARTMENTS
router.get("/departments", async (req, res) => {
  try {
    const [result] = await pool.query(`
      SELECT DepartmentID, DepartmentName
      FROM Departments
      ORDER BY DepartmentName
    `);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// REQUEST STOCK SELECTOR
router.get("/request-stock-selector", async (req, res) => {
  try {
    const search = req.query.search || "";
    const status = req.query.status || null;
    const type = req.query.type || null;

    const [result] = await pool.query(
      `
      SELECT *
      FROM (

          SELECT
              S.StockID,
              S.StockCardID,
              S.StockName,
              S.Description,
              S.Threshold,
              S.IsArchived,

              IFNULL(U.UnitName,'') AS UnitName,

              LEFT(S.StockCardID,2) AS StockType,

              IFNULL((
                  SELECT SUM(SI.Quantity)
                  FROM StockInvoices SI
                  WHERE SI.StockID = S.StockID
              ),0) AS Quantity,

              CASE
                  WHEN IFNULL((
                      SELECT SUM(SI.Quantity)
                      FROM StockInvoices SI
                      WHERE SI.StockID = S.StockID
                  ),0) = 0 THEN 'OutOfStock'

                  WHEN IFNULL((
                      SELECT SUM(SI.Quantity)
                      FROM StockInvoices SI
                      WHERE SI.StockID = S.StockID
                  ),0) <= S.Threshold THEN 'Critical'

                  ELSE 'OnStock'
              END AS StockStatus

          FROM Stocks S

          LEFT JOIN Units U
            ON S.UnitID = U.UnitID

          WHERE
            (
              S.StockName LIKE ?
              OR S.Description LIKE ?
              OR S.StockCardID LIKE ?
            )

      ) AS StockData

      WHERE
      (
          ? IS NULL
          OR (? = 'Archived' AND IsArchived = 1)
          OR (? = 'OutOfStock' AND StockStatus = 'OutOfStock')
          OR (? = 'Critical' AND StockStatus = 'Critical')
          OR (? = 'OnStock' AND StockStatus = 'OnStock')
      )

      AND
        (? IS NULL OR StockType = ?)

      ORDER BY StockName
      `,
      [
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        status,
        status,
        status,
        status,
        status,
        type,
        type,
      ],
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// GET STOCK INVOICES BY STOCK
router.get("/by-stock/:stockID", async (req, res) => {
  try {
    const { stockID } = req.params;

    const [result] = await pool.query(
      `
      SELECT
          SI.StockInvoiceID,
          SI.StockID,
          SI.InvoiceID,
          I.InvoiceNumber AS InvoiceNo,
          I.InvoiceDate AS ArrivedDate,
          SI.Quantity AS Quantity

      FROM StockInvoices SI

      JOIN Invoices I
        ON SI.InvoiceID = I.InvoiceID

      WHERE
          SI.StockID = ?
          AND SI.Quantity > 0

      ORDER BY I.InvoiceDate ASC
      `,
      [stockID],
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching invoices");
  }
});

// GET REQUEST DETAILS BY REQUISITION NUMBER
router.get("/:requisitionNo", async (req, res) => {
  try {
    const { requisitionNo } = req.params;

    // GET CURRENT YEAR
    const currentYear = new Date().getFullYear();

    // GET REQUEST INFO
    const [requestRows] = await pool.query(
      `
      SELECT
          R.RequestID,
          R.RequisitionNo,
          R.RequestedAt,
          R.ProcessedAt,
          R.Purpose,
          S.StatusName,
          D.DepartmentName,
          R.DepartmentID,
          E.Firstname,
          E.Lastname,
          R.AdminID,
          A.Firstname AS AdminFirstname,
          A.Lastname AS AdminLastname,
          R.Remarks

      FROM Request R

      JOIN Status S
        ON R.StatusID = S.StatusID

      JOIN Employees E
        ON R.EmployeeID = E.EmployeeID

      JOIN Departments D
        ON R.DepartmentID = D.DepartmentID

      LEFT JOIN Admin A
        ON R.AdminID = A.AdminID

      WHERE R.RequisitionNo = ?
      `,
      [requisitionNo],
    );

    if (!requestRows.length) {
      return res.status(404).send("Request not found");
    }

    const requestData = requestRows[0];

    // GET DEPARTMENT CREDIT
    const [creditRows] = await pool.query(
      `
      SELECT RemainingCredit, FiscalYear
      FROM DepartmentCredits
      WHERE DepartmentID = ?
        AND FiscalYear <= ?
      ORDER BY FiscalYear DESC
      LIMIT 1
      `,
      [requestData.DepartmentID, currentYear],
    );

    if (creditRows.length) {
      requestData.RemainingCredit = creditRows[0].RemainingCredit;
      requestData.CreditYear = creditRows[0].FiscalYear;
    } else {
      requestData.RemainingCredit = 0;
      requestData.CreditYear = null;
    }

    // GET REQUEST ITEMS
    const [items] = await pool.query(
      `
      SELECT
          RD.RequestDetailsID,
          RD.Quantity,
          S.StockID,
          S.StockCardID,
          S.StockName,
          S.Description,
          S.Price,
          U.UnitName,
          RDI.StockInvoiceID,
          RDI.Quantity AS InvoiceQty,
          I.InvoiceNumber AS InvoiceNo

      FROM RequestDetails RD

      JOIN Request R
        ON RD.RequestID = R.RequestID

      JOIN Stocks S
        ON RD.StockID = S.StockID

      LEFT JOIN Units U
        ON S.UnitID = U.UnitID

      LEFT JOIN RequestDetailsInvoice RDI
        ON RD.RequestDetailsID = RDI.RequestDetailsID

      LEFT JOIN StockInvoices SI
        ON RDI.StockInvoiceID = SI.StockInvoiceID

      LEFT JOIN Invoices I
        ON SI.InvoiceID = I.InvoiceID

      WHERE R.RequisitionNo = ?
      `,
      [requisitionNo],
    );

    // DECRYPT
    requestData.Firstname = decrypt(requestData.Firstname);
    requestData.Lastname = decrypt(requestData.Lastname);

    requestData.AdminFirstname = requestData.AdminFirstname
      ? decrypt(requestData.AdminFirstname)
      : null;

    requestData.AdminLastname = requestData.AdminLastname
      ? decrypt(requestData.AdminLastname)
      : null;

    // GROUP ITEMS
    const groupedItems = Object.values(
      items.reduce((acc, row) => {
        if (!acc[row.RequestDetailsID]) {
          acc[row.RequestDetailsID] = {
            RequestDetailsID: row.RequestDetailsID,
            Quantity: row.Quantity,
            StockID: row.StockID,
            StockCardID: row.StockCardID,
            StockName: row.StockName,
            Description: row.Description,
            UnitName: row.UnitName,
            Price: row.Price,
            TotalAmount: row.Quantity * row.Price,
            invoices: [],
          };
        }

        if (row.StockInvoiceID) {
          const existing = acc[row.RequestDetailsID].invoices.find(
            (inv) => inv.StockInvoiceID === row.StockInvoiceID,
          );

          if (existing) {
            existing.Quantity += row.InvoiceQty;
          } else {
            acc[row.RequestDetailsID].invoices.push({
              StockInvoiceID: row.StockInvoiceID,
              InvoiceNo: row.InvoiceNo,
              Quantity: row.InvoiceQty,
            });
          }
        }

        return acc;
      }, {}),
    );

    // GRAND TOTAL
    const grandTotal = groupedItems.reduce(
      (sum, item) => sum + item.TotalAmount,
      0,
    );

    res.json({
      request: requestData,
      items: groupedItems,
      grandTotal,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// GET ASSIGNED INVOICES
router.get("/assigned-invoices/:requestDetailsID", async (req, res) => {
  try {
    const { requestDetailsID } = req.params;

    const [result] = await pool.query(
      `
      SELECT
          SI.StockInvoiceID,
          SI.InvoiceID,
          I.InvoiceNumber AS InvoiceNo,

          SI.Quantity AS ActualQty,

          IFNULL(A.AssignedQty, 0) AS AssignedQty

      FROM StockInvoices SI

      JOIN Invoices I
        ON SI.InvoiceID = I.InvoiceID

      LEFT JOIN (
          SELECT
              StockInvoiceID,
              SUM(Quantity) AS AssignedQty
          FROM RequestDetailsInvoice
          WHERE RequestDetailsID = ?
          GROUP BY StockInvoiceID
      ) A
        ON SI.StockInvoiceID = A.StockInvoiceID

      WHERE A.StockInvoiceID IS NOT NULL

      ORDER BY I.InvoiceNumber
      `,
      [requestDetailsID],
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to fetch assigned invoices");
  }
});

// ASSIGN INVOICES
router.post("/assign-invoices", verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  const adminID = req.user.userId;

  try {
    const { RequestDetailsID, invoices } = req.body;

    if (!RequestDetailsID) {
      return res.status(400).send("RequestDetailsID is required");
    }

    await connection.beginTransaction();

    // 🔥 STEP 1: DELETE ALL EXISTING ASSIGNMENTS
    await connection.query(
      `
      DELETE FROM RequestDetailsInvoice
      WHERE RequestDetailsID = ?
      `,
      [RequestDetailsID],
    );

    // 🔥 STEP 2: INSERT NEW SELECTION (ONLY IF EXISTS)
    if (invoices && invoices.length > 0) {
      const values = invoices.map((inv) => [
        RequestDetailsID,
        inv.StockInvoiceID,
        inv.Quantity,
      ]);

      await connection.query(
        `
        INSERT INTO RequestDetailsInvoice
        (RequestDetailsID, StockInvoiceID, Quantity)
        VALUES ?
        `,
        [values],
      );
    }

    // 🔎 GET REQUEST INFO FOR AUDIT
    const [info] = await connection.query(
      `
      SELECT
          r.RequisitionNo,
          s.StockName,
          s.Description
      FROM RequestDetails rd
      JOIN Request r ON rd.RequestID = r.RequestID
      JOIN Stocks s ON rd.StockID = s.StockID
      WHERE rd.RequestDetailsID = ?
      `,
      [RequestDetailsID],
    );

    const data = info[0];

    // 🔎 BUILD AUDIT DETAILS
    let invoiceDetails = [];

    if (invoices && invoices.length > 0) {
      for (const inv of invoices) {
        const [invInfo] = await connection.query(
          `
          SELECT i.InvoiceNumber
          FROM StockInvoices si
          JOIN Invoices i ON si.InvoiceID = i.InvoiceID
          WHERE si.StockInvoiceID = ?
          `,
          [inv.StockInvoiceID],
        );

        const invoice = invInfo[0];

        if (invoice) {
          invoiceDetails.push(
            `${inv.Quantity} from [#${invoice.InvoiceNumber}]`,
          );
        }
      }
    }

    // 🧾 AUDIT LOG
    await logAudit({
      connection,
      location: "Requisition Control",
      action: "Assign Invoice",
      adminID,
      details: `[#${data.RequisitionNo}] ${data.StockName} - ${
        data.Description
      } assigned: ${
        invoiceDetails.length > 0
          ? invoiceDetails.join(", ")
          : "No invoices assigned"
      }`,
    });

    await connection.commit();

    res.send("Invoices replaced successfully");
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).send("Transaction failed");
  } finally {
    connection.release();
  }
});

// UPDATE REQUEST ITEM QUANTITY
router.put("/update/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  const adminID = req.user.userId;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const modifiedBy = req.user?.username || "Admin";

    // GET REQUEST DETAILS
    const [detailResult] = await connection.query(
      `
      SELECT
          RequestDetailsID,
          RequestID,
          StockID,
          Quantity
      FROM RequestDetails
      WHERE RequestDetailsID = ?
      `,
      [id],
    );

    const detail = detailResult[0];

    if (!detail) {
      await connection.rollback();
      return res.status(404).send("Item not found");
    }

    const oldQty = detail.Quantity;

    // GET ORIGINAL CREATED QUANTITY
    const [createdResult] = await connection.query(
      `
      SELECT NewQuantity
      FROM RequestDetailsHistory
      WHERE RequestID = ?
        AND StockID = ?
        AND Action = 'Created'
      ORDER BY ModifiedAt ASC
      LIMIT 1
      `,
      [detail.RequestID, detail.StockID],
    );

    const originalQty =
      createdResult.length > 0 ? createdResult[0].NewQuantity : oldQty;

    // UPDATE REQUEST DETAILS
    await connection.query(
      `
      UPDATE RequestDetails
      SET Quantity = ?
      WHERE RequestDetailsID = ?
      `,
      [quantity, id],
    );

    // CLEAR ASSIGNED INVOICES
    await connection.query(
      `
      DELETE FROM RequestDetailsInvoice
      WHERE RequestDetailsID = ?
      `,
      [id],
    );

    // REMOVE OLD EDIT HISTORY
    await connection.query(
      `
      DELETE FROM RequestDetailsHistory
      WHERE RequestID = ?
        AND StockID = ?
        AND Action = 'Edit'
      `,
      [detail.RequestID, detail.StockID],
    );

    // IF REVERTED TO ORIGINAL QUANTITY
    if (quantity === originalQty) {
      await connection.commit();
      return res.sendStatus(200);
    }

    // INSERT EDIT HISTORY
    await connection.query(
      `
      INSERT INTO RequestDetailsHistory
      (
        RequestDetailsID,
        RequestID,
        StockID,
        OldQuantity,
        NewQuantity,
        Action,
        ModifiedAt,
        ModifiedBy
      )
      VALUES (?, ?, ?, ?, ?, 'Edit', UTC_TIMESTAMP(), ?)
      `,
      [id, detail.RequestID, detail.StockID, oldQty, quantity, modifiedBy],
    );

    // GET REQUEST + STOCK INFO
    const [info] = await connection.query(
      `
      SELECT
          r.RequisitionNo,
          s.StockName,
          s.Description

      FROM Request r

      JOIN Stocks s
        ON s.StockID = ?

      WHERE r.RequestID = ?
      `,
      [detail.StockID, detail.RequestID],
    );

    const data = info[0];

    // AUDIT LOG
    await logAudit({
      connection,
      location: "Requisition Control",
      action: "Edit Request",
      adminID,
      details: `[#${data.RequisitionNo}] ${data.StockName} - ${data.Description} change quantity ${oldQty} to ${quantity}`,
    });

    await connection.commit();

    res.sendStatus(200);
  } catch (err) {
    await connection.rollback();

    console.error(err);
    res.status(500).send("Update failed");
  } finally {
    connection.release();
  }
});

//
// ADD REQUEST ITEM
//
router.post("/request-details/add", verifyToken, async (req, res) => {
  const { RequestID, StockID, Quantity } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const modifiedBy = req.user?.username || "Unknown";

    // CHECK REMOVE HISTORY
    const [removeCheck] = await connection.query(
      `
      SELECT *
      FROM RequestDetailsHistory
      WHERE RequestID = ?
        AND StockID = ?
        AND Action = 'Remove'
      ORDER BY ModifiedAt DESC
      LIMIT 1
      `,
      [RequestID, StockID],
    );

    // UNDO REMOVE
    if (removeCheck.length > 0) {
      const removeRow = removeCheck[0];

      // GET CREATED QUANTITY
      const [createdCheck] = await connection.query(
        `
        SELECT NewQuantity
        FROM RequestDetailsHistory
        WHERE RequestID = ?
          AND StockID = ?
          AND Action = 'Created'
        ORDER BY ModifiedAt ASC
        LIMIT 1
        `,
        [RequestID, StockID],
      );

      let finalQty;

      if (createdCheck.length > 0) {
        finalQty = createdCheck[0].NewQuantity;
      } else {
        finalQty = removeRow.OldQuantity || Quantity;
      }

      // DELETE REMOVE HISTORY
      await connection.query(
        `
        DELETE FROM RequestDetailsHistory
        WHERE RequestDetailsHistoryID = ?
        `,
        [removeRow.RequestDetailsHistoryID],
      );

      // REINSERT REQUEST DETAIL
      await connection.query(
        `
        INSERT INTO RequestDetails
        (
          RequestID,
          StockID,
          Quantity
        )
        VALUES (?, ?, ?)
        `,
        [RequestID, StockID, finalQty],
      );

      // GET INFO
      const [info] = await connection.query(
        `
        SELECT
            r.RequisitionNo,
            s.StockName,
            s.Description

        FROM Request r

        JOIN Stocks s
          ON s.StockID = ?

        WHERE r.RequestID = ?
        `,
        [StockID, RequestID],
      );

      const data = info[0];

      // AUDIT LOG
      await logAudit({
        connection,
        location: "Requisition Control",
        action: "Add Item",
        adminID: req.user.userId,
        details: `${data.StockName} - ${data.Description} Added to [#${data.RequisitionNo}]`,
      });

      await connection.commit();

      return res.sendStatus(200);
    }

    // NORMAL ADD
    const [insertResult] = await connection.query(
      `
      INSERT INTO RequestDetails
      (
        RequestID,
        StockID,
        Quantity
      )
      VALUES (?, ?, ?)
      `,
      [RequestID, StockID, Quantity],
    );

    const requestDetailsID = insertResult.insertId;

    // INSERT HISTORY
    await connection.query(
      `
      INSERT INTO RequestDetailsHistory
      (
        RequestDetailsID,
        RequestID,
        StockID,
        OldQuantity,
        NewQuantity,
        Action,
        ModifiedAt,
        ModifiedBy
      )
      VALUES (?, ?, ?, ?, ?, 'Added', UTC_TIMESTAMP(), ?)
      `,
      [requestDetailsID, RequestID, StockID, 0, Quantity, modifiedBy],
    );

    await connection.commit();

    res.sendStatus(200);
  } catch (err) {
    console.error(err);

    await connection.rollback();

    res.status(500).send("Failed to add item");
  } finally {
    connection.release();
  }
});

//
// DELETE REQUEST ITEM
//
router.delete("/request-details/delete/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // GET REQUEST DETAIL
    const [detailResult] = await connection.query(
      `
      SELECT
          RequestDetailsID,
          RequestID,
          StockID,
          Quantity
      FROM RequestDetails
      WHERE RequestDetailsID = ?
      `,
      [id],
    );

    const detail = detailResult[0];

    // SAFETY CHECK
    if (!detail) {
      await connection.rollback();
      return res.status(404).send("Item not found");
    }

    const modifiedBy = req.user?.username || "Unknown";

    // CHECK IF ADDED HISTORY EXISTS
    const [historyCheck] = await connection.query(
      `
      SELECT RequestDetailsHistoryID
      FROM RequestDetailsHistory
      WHERE RequestID = ?
        AND StockID = ?
        AND Action = 'Added'
      ORDER BY ModifiedAt DESC
      LIMIT 1
      `,
      [detail.RequestID, detail.StockID],
    );

    const hasAdded = historyCheck.length > 0;

    // UNDO ADD
    if (hasAdded) {
      await connection.query(
        `
        DELETE FROM RequestDetailsHistory
        WHERE RequestDetailsHistoryID = ?
        `,
        [historyCheck[0].RequestDetailsHistoryID],
      );
    } else {
      // INSERT REMOVE HISTORY
      await connection.query(
        `
        INSERT INTO RequestDetailsHistory
        (
          RequestDetailsID,
          RequestID,
          StockID,
          OldQuantity,
          NewQuantity,
          Action,
          ModifiedAt,
          ModifiedBy
        )
        VALUES (?, ?, ?, ?, ?, 'Remove', UTC_TIMESTAMP(), ?)
        `,
        [id, detail.RequestID, detail.StockID, detail.Quantity, 0, modifiedBy],
      );
    }

    // DELETE REQUEST DETAIL
    await connection.query(
      `
      DELETE FROM RequestDetails
      WHERE RequestDetailsID = ?
      `,
      [id],
    );

    // GET REQUEST + STOCK INFO
    const [info] = await connection.query(
      `
      SELECT
          r.RequisitionNo,
          s.StockName,
          s.Description

      FROM Request r

      JOIN Stocks s
        ON s.StockID = ?

      WHERE r.RequestID = ?
      `,
      [detail.StockID, detail.RequestID],
    );

    const data = info[0];

    // AUDIT LOG
    await logAudit({
      connection,
      location: "Requisition Control",
      action: "Remove Item",
      adminID: req.user.userId,
      details: `${data.StockName} - ${data.Description} removed from [#${data.RequisitionNo}]`,
    });

    await connection.commit();

    res.sendStatus(200);
  } catch (err) {
    console.error(err);

    await connection.rollback();

    res.status(500).send("Failed to delete item");
  } finally {
    connection.release();
  }
});

router.get("/history-summary/:requestID", async (req, res) => {
  try {
    const { requestID } = req.params;

    const [rows] = await pool.query(
      `
      SELECT 
          H.Action,
          H.OldQuantity,
          H.NewQuantity,
          S.StockName,
          S.Description
      FROM RequestDetailsHistory H
      JOIN Stocks S ON H.StockID = S.StockID
      WHERE H.RequestID = ?
        AND H.Action <> 'Created'
      ORDER BY H.ModifiedAt ASC
      `,
      [requestID],
    );

    const formatted = rows
      .map((r) => {
        const itemName = `${r.StockName} - ${r.Description}`;

        if (r.Action === "Edit") {
          return `Edit ${itemName} quantity ${r.OldQuantity} to ${r.NewQuantity}`;
        }

        if (r.Action === "Remove") {
          return `Remove ${itemName}`;
        }

        if (r.Action === "Added") {
          return `Add ${itemName}`;
        }

        return null;
      })
      .filter(Boolean);

    res.json({
      text: formatted.join(", "),
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to fetch history");
  }
});

router.get("/validate-invoices/:requisitionNo", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { requisitionNo } = req.params;

    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
      SELECT 
          RDI.RequestDetailsInvoiceID,
          RDI.RequestDetailsID,
          RDI.StockInvoiceID,
          RDI.Quantity,
          SI.Quantity AS AvailableQty
      FROM RequestDetailsInvoice RDI
      JOIN RequestDetails RD ON RDI.RequestDetailsID = RD.RequestDetailsID
      JOIN Request R ON RD.RequestID = R.RequestID
      JOIN StockInvoices SI ON RDI.StockInvoiceID = SI.StockInvoiceID
      WHERE R.RequisitionNo = ?
      `,
      [requisitionNo],
    );

    const invalid = rows.filter((r) => r.Quantity > r.AvailableQty);

    for (const row of invalid) {
      await connection.query(
        `
        UPDATE RequestDetailsInvoice
        SET Quantity = 0
        WHERE RequestDetailsInvoiceID = ?
        `,
        [row.RequestDetailsInvoiceID],
      );
    }

    await connection.commit();

    res.json({
      isValid: invalid.length === 0,
      invalid,
    });
  } catch (err) {
    console.error(err);

    await connection.rollback();

    res.status(500).send("Validation error");
  } finally {
    connection.release();
  }
});

router.put("/accept/:requestID", verifyToken, async (req, res) => {
  const { requestID } = req.params;
  const { remarks } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [statusRows] = await connection.query(
      `
      SELECT StatusID 
      FROM Request 
      WHERE RequestID = ?
      `,
      [requestID],
    );

    if (!statusRows.length) {
      await connection.rollback();
      return res.status(404).send("Request not found");
    }

    if (statusRows[0].StatusID === 2) {
      await connection.rollback();
      return res.status(400).send("Already accepted");
    }

    const [reqRows] = await connection.query(
      `
      SELECT DepartmentID
      FROM Request
      WHERE RequestID = ?
      `,
      [requestID],
    );

    const departmentID = reqRows[0].DepartmentID;

    const [amountRows] = await connection.query(
      `
      SELECT SUM(RD.Quantity * S.Price) AS TotalAmount
      FROM RequestDetails RD
      JOIN Stocks S ON RD.StockID = S.StockID
      WHERE RD.RequestID = ?
      `,
      [requestID],
    );

    const totalAmount = Number(amountRows[0].TotalAmount || 0);

    if (totalAmount <= 0) {
      await connection.rollback();
      return res.status(400).send("Invalid total amount");
    }

    const currentYear = new Date().getFullYear();

    const [yearRows] = await connection.query(
      `
      SELECT FiscalYear, RemainingCredit
      FROM DepartmentCredits
      WHERE DepartmentID = ?
        AND FiscalYear <= ?
      ORDER BY FiscalYear DESC
      LIMIT 1
      `,
      [departmentID, currentYear],
    );

    if (!yearRows.length) {
      await connection.rollback();
      return res.status(400).send("No budget found for department");
    }

    const useYear = yearRows[0].FiscalYear;
    const remainingCredit = Number(yearRows[0].RemainingCredit || 0);

    if (remainingCredit <= 0) {
      await connection.rollback();
      return res.status(400).send("No remaining budget");
    }

    if (remainingCredit < totalAmount) {
      await connection.rollback();
      return res
        .status(400)
        .send(`Insufficient budget. Remaining: ${remainingCredit}`);
    }

    // VALIDATION
    const [itemRows] = await connection.query(
      `
      SELECT 
          RD.RequestDetailsID,
          RD.Quantity AS RequestedQty,
          RDI.StockInvoiceID,
          RDI.Quantity AS InvoiceQty
      FROM RequestDetails RD
      LEFT JOIN RequestDetailsInvoice RDI
          ON RD.RequestDetailsID = RDI.RequestDetailsID
      WHERE RD.RequestID = ?
      `,
      [requestID],
    );

    const grouped = {};

    for (const row of itemRows) {
      if (!grouped[row.RequestDetailsID]) {
        grouped[row.RequestDetailsID] = {
          requestedQty: row.RequestedQty,
          invoices: [],
        };
      }

      if (row.StockInvoiceID) {
        grouped[row.RequestDetailsID].invoices.push({
          StockInvoiceID: row.StockInvoiceID,
          qty: row.InvoiceQty,
        });
      }
    }

    for (const itemID in grouped) {
      const item = grouped[itemID];

      const totalInvoiceQty = item.invoices.reduce(
        (sum, inv) => sum + Number(inv.qty || 0),
        0,
      );

      if (item.invoices.length === 0 || totalInvoiceQty !== item.requestedQty) {
        await connection.rollback();
        return res.status(400).send("Invoice validation failed");
      }
    }

    // STOCK DEDUCTION
    const [deductionRows] = await connection.query(
      `
      SELECT 
          RDI.StockInvoiceID,
          SUM(RDI.Quantity) AS DeductQty
      FROM RequestDetailsInvoice RDI
      JOIN RequestDetails RD 
          ON RD.RequestDetailsID = RDI.RequestDetailsID
      WHERE RD.RequestID = ?
      GROUP BY RDI.StockInvoiceID
      `,
      [requestID],
    );

    for (const row of deductionRows) {
      const [updateResult] = await connection.query(
        `
        UPDATE StockInvoices
        SET Quantity = Quantity - ?
        WHERE StockInvoiceID = ?
          AND Quantity >= ?
        `,
        [row.DeductQty, row.StockInvoiceID, row.DeductQty],
      );

      if (updateResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(400).send("Stock deduction failed");
      }
    }

    // DEDUCT BUDGET
    await connection.query(
      `
      UPDATE DepartmentCredits
      SET RemainingCredit = RemainingCredit - ?
      WHERE DepartmentID = ?
        AND FiscalYear = ?
      `,
      [totalAmount, departmentID, useYear],
    );

    // UPDATE REQUEST
    await connection.query(
      `
      UPDATE Request
      SET 
        StatusID = 2,
        ProcessedAt = UTC_TIMESTAMP(),
        Remarks = ?,
        AdminID = ?
      WHERE RequestID = ?
      `,
      [remarks || "", req.user.userId, requestID],
    );

    await connection.commit();

    res.send("Request accepted successfully");
  } catch (err) {
    console.error(err);

    await connection.rollback();

    res.status(500).send(err.message || "Failed to accept request");
  } finally {
    connection.release();
  }
});

router.put("/reject/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { remarks } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [infoRows] = await connection.query(
      `
      SELECT RequisitionNo
      FROM Request
      WHERE RequestID = ?
      `,
      [id],
    );

    if (!infoRows.length) {
      await connection.rollback();
      return res.status(404).send("Request not found");
    }

    const requisitionNo = infoRows[0].RequisitionNo;

    await connection.query(
      `
      UPDATE Request
      SET 
        StatusID = 3,
        Remarks = ?,
        ProcessedAt = UTC_TIMESTAMP(),
        AdminID = ?
      WHERE RequestID = ?
      `,
      [remarks, req.user.userId, id],
    );

    await connection.query(
      `
      DELETE FROM RequestDetailsHistory
      WHERE RequestID = ?
      `,
      [id],
    );

    await connection.query(
      `
      DELETE FROM RequestDetailsInvoice
      WHERE RequestDetailsID IN (
          SELECT RequestDetailsID
          FROM RequestDetails
          WHERE RequestID = ?
      )
      `,
      [id],
    );

    await logAudit({
      connection,
      location: "Requisition Control",
      action: "Reject Request",
      adminID: req.user.userId,
      details: `[#${requisitionNo}] Rejected Request${remarks ? ` | Remarks: ${remarks}` : ""}`,
    });

    await connection.commit();

    res.send("Request rejected successfully");
  } catch (err) {
    console.error(err);

    await connection.rollback();

    res.status(500).send("Failed to reject request");
  } finally {
    connection.release();
  }
});

router.put("/remarks/:requestID", verifyToken, async (req, res) => {
  const { requestID } = req.params;
  const { remarks } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [infoRows] = await connection.query(
      `
      SELECT RequisitionNo, Remarks
      FROM Request
      WHERE RequestID = ?
      `,
      [requestID],
    );

    const oldRemarks = infoRows[0].Remarks;

    await connection.query(
      `
      UPDATE Request
      SET Remarks = ?
      WHERE RequestID = ?
      `,
      [remarks, requestID],
    );

    await logAudit({
      connection,
      location: "Requisition Control",
      action: "Edit Remarks",
      adminID: req.user.userId,
      details: `[#${infoRows[0].RequisitionNo}] Updated remarks FROM "${oldRemarks || "-"}" TO "${remarks || "-"}"`,
    });

    await connection.commit();

    res.send("Remarks updated");
  } catch (err) {
    console.error(err);

    await connection.rollback();

    res.status(500).send("Failed to update remarks");
  } finally {
    connection.release();
  }
});

module.exports = router;
