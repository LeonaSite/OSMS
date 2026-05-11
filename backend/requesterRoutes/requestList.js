const express = require("express");
const router = express.Router();
const pool = require("../db"); // ✅ MySQL pool
const verifyRequester = require("../middleware/requesterAuth");

router.get("/", verifyRequester, async (req, res) => {
  try {
    const EmployeeID = req.user.userId;

    const [rows] = await pool.query(
      `
      SELECT
        R.RequestID,
        R.RequisitionNo,
        R.RequestedAt,
        R.ProcessedAt,
        R.Remarks,
        S.StatusName,

        RD.RequestDetailsID,
        RD.Quantity,

        ST.StockName,
        ST.Description

      FROM Request R
      JOIN RequestDetails RD ON RD.RequestID = R.RequestID
      JOIN Stocks ST ON ST.StockID = RD.StockID
      JOIN Status S ON S.StatusID = R.StatusID

      WHERE R.EmployeeID = ?
      ORDER BY R.RequestedAt DESC
      `,
      [EmployeeID],
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
