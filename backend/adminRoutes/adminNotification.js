const express = require("express");
const router = express.Router();
const { decrypt } = require("../encryption/crypto");
const pool = require("../db");

// ✅ NEW REQUESTS
router.get("/new-requests", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        R.RequestID,
        R.RequisitionNo,
        R.RequestedAt,
        E.Firstname,
        E.Lastname,
        RD.Quantity,
        S.StockName,
        S.Description,
        S.Price,
        U.UnitName
      FROM Request R
      JOIN Employees E ON R.EmployeeID = E.EmployeeID
      JOIN RequestDetails RD ON R.RequestID = RD.RequestID
      JOIN Stocks S ON RD.StockID = S.StockID
      JOIN Units U ON S.UnitID = U.UnitID
      WHERE R.StatusID = 1
      ORDER BY R.RequestedAt DESC
    `);

    const grouped = {};

    rows.forEach((row) => {
      const requestId = row.RequestID;

      if (!grouped[requestId]) {
        grouped[requestId] = {
          requestId,
          requisitionNo: row.RequisitionNo,
          requestedAt: row.RequestedAt,
          fullname: `${decrypt(row.Firstname)} ${decrypt(row.Lastname)}`,
          items: [],
          total: 0,
        };
      }

      const subtotal = row.Quantity * row.Price;
      grouped[requestId].total += subtotal;

      grouped[requestId].items.push(
        `${row.Quantity} ${row.UnitName.toUpperCase()}${
          row.Quantity > 1 ? "S" : ""
        } of ${row.StockName} (${row.Description})`,
      );
    });

    const formatted = Object.values(grouped).map((r) => ({
      requestId: r.requestId,
      requestedAt: r.requestedAt,
      title: `✉️ New Request: ${r.fullname}`,
      body: `[#${r.requisitionNo || r.requestId}]: ${r.items.join(
        ", ",
      )}. With a total amount of Php. ${r.total.toLocaleString()}`,
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ PROCESSED REQUESTS
router.get("/processed-requests", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        R.RequestID,
        R.StatusID,
        R.ProcessedAt,
        R.RequisitionNo,
        A.Firstname AS AdminFirst,
        A.Lastname AS AdminLast,
        RD.Quantity,
        S.StockName,
        S.Description,
        S.Price,
        U.UnitName
      FROM Request R
      JOIN Admin A ON R.AdminID = A.AdminID
      JOIN RequestDetails RD ON R.RequestID = RD.RequestID
      JOIN Stocks S ON RD.StockID = S.StockID
      JOIN Units U ON S.UnitID = U.UnitID
      WHERE R.StatusID IN (2,3)
      ORDER BY R.ProcessedAt DESC
    `);

    const grouped = {};

    rows.forEach((row) => {
      const id = row.RequestID;

      if (!grouped[id]) {
        grouped[id] = {
          requestId: id,
          statusId: row.StatusID,
          processedAt: row.ProcessedAt,
          requisitionNo: row.RequisitionNo,
          adminName: `${decrypt(row.AdminFirst)} ${decrypt(row.AdminLast)}`,
          items: [],
          total: 0,
        };
      }

      const subtotal = row.Quantity * row.Price;
      grouped[id].total += subtotal;

      grouped[id].items.push(
        `${row.Quantity} ${row.UnitName.toUpperCase()}${
          row.Quantity > 1 ? "S" : ""
        } of ${row.StockName} (${row.Description})`,
      );
    });

    const formatted = Object.values(grouped).map((r) => {
      const isAccepted = r.statusId === 2;

      return {
        requestId: r.requestId,
        processedAt: r.processedAt,
        title: isAccepted
          ? `✅ ${r.adminName} Accepted the request.`
          : `❌ ${r.adminName} Rejected the request.`,
        body: `[#${r.requisitionNo}]: ${r.items.join(
          ", ",
        )}. With a total amount of Php. ${r.total.toLocaleString()}`,
        statusId: r.statusId,
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ LOW STOCK ALERTS
router.get("/low-stock-alerts", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.StockID,
        s.StockName,
        s.Description,
        u.UnitName,
        IFNULL((
          SELECT SUM(si.Quantity)
          FROM StockInvoices si
          WHERE si.StockID = s.StockID
        ), 0) AS Quantity,
        s.Threshold
      FROM Stocks s
      LEFT JOIN Units u ON s.UnitID = u.UnitID
      WHERE (s.IsArchived = 0 OR s.IsArchived IS NULL)
    `);

    const criticalItems = rows.filter(
      (item) => item.Quantity > 0 && item.Quantity <= item.Threshold,
    );

    const formatted = criticalItems.map((item) => ({
      stockId: item.StockID,
      title: "⚠️ Low Stock Alert!",
      body: `${item.StockName} (${item.Description}) has ${
        item.Quantity
      } ${item.UnitName.toUpperCase()}${
        item.Quantity > 1 ? "S" : ""
      } remaining.`,
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
