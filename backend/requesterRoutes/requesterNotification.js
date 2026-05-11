const express = require("express");
const router = express.Router();
const pool = require("../db"); // ✅ MySQL pool
const verifyRequester = require("../middleware/requesterAuth");

router.get("/processed", verifyRequester, async (req, res) => {
  try {
    const employeeId = req.user.userId;

    const [rows] = await pool.query(
      `
      SELECT 
        R.RequestID,
        R.StatusID,
        R.ProcessedAt,
        R.RequisitionNo,

        RD.Quantity,
        S.StockName,
        S.Description,
        U.UnitName

      FROM \`Request\` R
      JOIN RequestDetails RD ON R.RequestID = RD.RequestID
      JOIN Stocks S ON RD.StockID = S.StockID
      JOIN Units U ON S.UnitID = U.UnitID

      WHERE 
        R.EmployeeID = ?
        AND R.StatusID IN (2,3)

      ORDER BY R.ProcessedAt DESC
      `,
      [employeeId],
    );

    const grouped = {};

    rows.forEach((row) => {
      const id = row.RequestID;

      if (!grouped[id]) {
        grouped[id] = {
          requestId: id,
          statusId: row.StatusID,
          processedAt: row.ProcessedAt,
          requisitionNo: row.RequisitionNo,
          items: [],
        };
      }

      const unit = row.UnitName ? row.UnitName.toUpperCase() : "";

      grouped[id].items.push(
        `${row.Quantity} ${unit}${row.Quantity > 1 ? "S" : ""} of ${row.StockName} (${row.Description})`,
      );
    });

    const formatted = Object.values(grouped).map((r) => {
      const isAccepted = r.statusId === 2;

      return {
        requestId: r.requestId,
        processedAt: r.processedAt,
        statusId: r.statusId,
        title: isAccepted
          ? "✅ Your Request Was Accepted!"
          : "❌ Your Request Was Rejected!",
        body: `[#${r.requisitionNo}]: ${r.items.join(", ")}`,
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
