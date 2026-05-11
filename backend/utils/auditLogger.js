const pool = require("../db");

const logAudit = async ({
  connection = null, // optional transaction connection
  location,
  action,
  details,
  adminID,
}) => {
  try {
    const conn = connection || pool;

    await conn.query(
      `
      INSERT INTO AuditLogs
      (Location, Action, AdminID, Details, RecordedAt)
      VALUES (?, ?, ?, ?, NOW())
      `,
      [location, action, adminID || null, details],
    );
  } catch (err) {
    console.error("Audit Log Error:", err);
  }
};

module.exports = { logAudit };
