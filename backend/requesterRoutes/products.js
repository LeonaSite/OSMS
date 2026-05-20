const express = require("express");
const router = express.Router();
const verifyRequester = require("../middleware/requesterAuth");
const pool = require("../db"); //  use mysql pool

// GET PRODUCTS
router.get("/", verifyRequester, async (req, res) => {
  try {
    let {
      page = 1,
      limit = 50,
      sortKey = "StockName",
      sortDir = "asc",
    } = req.query;

    page = parseInt(page);
    limit = Math.min(parseInt(limit), 100);
    const offset = (page - 1) * limit;

    const validSort = ["StockName", "Quantity"];
    const orderBy = validSort.includes(sortKey) ? sortKey : "StockName";
    const direction = sortDir === "desc" ? "DESC" : "ASC";

    const employeeID = req.user.userId;

    //  1. GET DEPARTMENT + CREDIT
    const [[emp]] = await pool.query(
      `SELECT DepartmentID FROM Employees WHERE EmployeeID = ?`,
      [employeeID],
    );

    if (!emp) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const departmentID = emp.DepartmentID;

    const [[creditData]] = await pool.query(
      `
      SELECT 
        IFNULL(RemainingCredit, 0) AS RemainingCredit,
        FiscalYear AS CreditYear
      FROM DepartmentCredits
      WHERE DepartmentID = ?
      AND FiscalYear = (
        SELECT MAX(FiscalYear)
        FROM DepartmentCredits
        WHERE DepartmentID = ?
        AND FiscalYear <= YEAR(NOW())
      )
      `,
      [departmentID, departmentID],
    );

    const remainingCredit = creditData?.RemainingCredit || 0;
    const creditYear = creditData?.CreditYear || null;

    //  2. MAIN DATA QUERY
    const [data] = await pool.query(
      `
      SELECT 
        S.StockID,
        S.StockName,
        S.Description,
        S.Price,
        S.Threshold,
        U.UnitName,
        IFNULL(SUM(SI.Quantity), 0) AS Quantity,

        CASE 
          WHEN EXISTS (
            SELECT 1
            FROM Request R
            INNER JOIN RequestDetails RD ON R.RequestID = RD.RequestID
            WHERE RD.StockID = S.StockID
            AND R.EmployeeID = ?
            AND R.StatusID = 1
          ) THEN 1
          ELSE 0
        END AS HasPendingRequest

      FROM Stocks S
      LEFT JOIN StockInvoices SI ON S.StockID = SI.StockID
      LEFT JOIN Units U ON S.UnitID = U.UnitID
      WHERE S.IsArchived = 0
      GROUP BY 
        S.StockID, S.StockName, S.Description, S.Price, S.Threshold, U.UnitName
      HAVING IFNULL(SUM(SI.Quantity), 0) > S.Threshold

      ORDER BY ${orderBy} ${direction}
      LIMIT ? OFFSET ?
      `,
      [employeeID, limit, offset],
    );

    //  3. TOTAL COUNT
    const [[totalRow]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM (
        SELECT S.StockID
        FROM Stocks S
        LEFT JOIN StockInvoices SI ON S.StockID = SI.StockID
        WHERE S.IsArchived = 0
        GROUP BY S.StockID, S.Threshold
        HAVING IFNULL(SUM(SI.Quantity), 0) > S.Threshold
      ) AS StockData
      `,
    );

    res.json({
      data: data.map((item) => ({
        ...item,
        RemainingCredit: remainingCredit,
        CreditYear: creditYear,
      })),
      total: totalRow.total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// SEND REQUEST
router.post("/send-request", verifyRequester, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const { items, Purpose } = req.body;
    const EmployeeID = req.user.userId;

    const finalPurpose = Purpose?.trim() ? Purpose : "FOR OFFICE USE";

    if (!items || items.length === 0) {
      return res.status(400).send("No items selected");
    }

    for (const item of items) {
      if (!item.StockID || !item.quantity || item.quantity <= 0) {
        return res.status(400).send("Invalid item data");
      }
    }

    //  GET DEPARTMENT
    const [[emp]] = await conn.query(
      `SELECT DepartmentID FROM Employees WHERE EmployeeID = ?`,
      [EmployeeID],
    );

    const departmentID = emp.DepartmentID;

    //  GET CREDIT
    const [[credit]] = await conn.query(
      `
      SELECT 
        IFNULL(RemainingCredit, 0) AS RemainingCredit,
        FiscalYear AS CreditYear
      FROM DepartmentCredits
      WHERE DepartmentID = ?
      AND FiscalYear = (
        SELECT MAX(FiscalYear)
        FROM DepartmentCredits
        WHERE DepartmentID = ?
        AND FiscalYear <= YEAR(NOW())
      )
      `,
      [departmentID, departmentID],
    );

    const remainingCredit = credit?.RemainingCredit || 0;
    const creditYear = credit?.CreditYear;

    //  CALCULATE TOTAL COST
    let totalCost = 0;

    for (const item of items) {
      const [[stock]] = await conn.query(
        `SELECT Price FROM Stocks WHERE StockID = ?`,
        [item.StockID],
      );

      totalCost += stock.Price * item.quantity;
    }

    /* -------------------------------------------------------------
       CREDITS DISABLE: COMMENTED OUT CREDIT CHECK LIMITATION
    ------------------------------------------------------------- */
    // if (totalCost > remainingCredit) {
    //   return res.status(400).send("Request exceeds department credit");
    // }

    //  GENERATE UNIQUE REQUISITION NO
    let requisitionNo;
    let exists = true;

    while (exists) {
      requisitionNo = Math.floor(100000 + Math.random() * 900000);

      const [[check]] = await conn.query(
        `SELECT RequisitionNo FROM Request WHERE RequisitionNo = ?`,
        [requisitionNo],
      );

      if (!check) exists = false;
    }

    //  TRANSACTION START
    await conn.beginTransaction();

    //  INSERT REQUEST
    const [requestResult] = await conn.query(
      `
      INSERT INTO Request
      (RequisitionNo, DepartmentID, EmployeeID, RequestedAt, StatusID, Purpose)
      VALUES (?, ?, ?, NOW(), 1, ?)
      `,
      [requisitionNo, departmentID, EmployeeID, finalPurpose],
    );

    const requestID = requestResult.insertId;

    //  INSERT DETAILS
    for (const item of items) {
      await conn.query(
        `
        INSERT INTO RequestDetails
        (RequestID, StockID, Quantity)
        VALUES (?, ?, ?)
        `,
        [requestID, item.StockID, item.quantity],
      );
    }

    /* -------------------------------------------------------------
       CREDITS DISABLE: COMMENTED OUT CREDIT DEDUCTION
    ------------------------------------------------------------- */
    // await conn.query(
    //   `
    //   UPDATE DepartmentCredits
    //   SET RemainingCredit = RemainingCredit - ?
    //   WHERE DepartmentID = ?
    //   AND FiscalYear = ?
    //   `,
    //   [totalCost, departmentID, creditYear],
    // );

    await conn.commit();

    res.send({
      message: "Request created successfully",
      RequisitionNo: requisitionNo,
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).send(err.message);
  } finally {
    conn.release();
  }
});

module.exports = router;
