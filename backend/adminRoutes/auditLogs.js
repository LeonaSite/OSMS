const express = require("express");
const router = express.Router();
const pool = require("../db");
const { decrypt } = require("../encryption/crypto");

// ✅ GET /api/audit-logs
router.get("/", async (req, res) => {
  const {
    location = "",
    action = "",
    from = "",
    to = "",
    page = 1,
    limit = 100,
  } = req.query;

  const safePage = Math.max(parseInt(page) || 1, 1);
  const safeLimit = Math.max(parseInt(limit) || 100, 1);
  const offset = (safePage - 1) * safeLimit;

  try {
    let where = [];
    let params = [];

    if (location) {
      where.push("a.Location = ?");
      params.push(location);
    }

    if (action) {
      where.push("a.Action = ?");
      params.push(action);
    }

    if (from) {
      where.push("a.RecordedAt >= ?");
      params.push(from);
    }

    if (to) {
      where.push("a.RecordedAt <= ?");
      params.push(to);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // ✅ DATA QUERY
    const dataQuery = `
      SELECT 
        a.AuditID,
        a.Action,
        a.Details,
        a.RecordedAt,
        a.Location,
        ad.Firstname,
        ad.Lastname
      FROM AuditLogs a
      INNER JOIN Admin ad ON a.AdminID = ad.AdminID
      ${whereClause}
      ORDER BY a.RecordedAt DESC
      LIMIT ? OFFSET ?
    `;

    // ✅ COUNT QUERY
    const countQuery = `
      SELECT COUNT(*) as total
      FROM AuditLogs a
      INNER JOIN Admin ad ON a.AdminID = ad.AdminID
      ${whereClause}
    `;

    const [dataRows] = await pool.query(dataQuery, [
      ...params,
      safeLimit,
      offset,
    ]);
    const [countRows] = await pool.query(countQuery, params);

    const safeDecrypt = (value) => {
      try {
        return decrypt(value);
      } catch {
        return value;
      }
    };

    const decryptedData = dataRows.map((row) => ({
      ...row,
      Firstname: safeDecrypt(row.Firstname),
      Lastname: safeDecrypt(row.Lastname),
      FullName: `${safeDecrypt(row.Firstname)} ${safeDecrypt(row.Lastname)}`,
    }));

    res.json({
      data: decryptedData,
      total: countRows[0].total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(countRows[0].total / safeLimit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ✅ GET /locations
router.get("/locations", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT Location FROM AuditLogs ORDER BY Location
    `);

    res.json(rows.map((r) => r.Location));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ✅ GET /actions (SAFE VERSION)
router.get("/actions", async (req, res) => {
  const { location = "" } = req.query;

  try {
    let query = `SELECT DISTINCT Action FROM AuditLogs`;
    let params = [];

    if (location) {
      query += ` WHERE Location = ?`;
      params.push(location);
    }

    query += ` ORDER BY Action`;

    const [rows] = await pool.query(query, params);

    res.json(rows.map((r) => r.Action));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
