const express = require("express");
const router = express.Router();
const pool = require("../db"); // ✅ USE MYSQL POOL
const bcrypt = require("bcrypt");
const { encrypt, decrypt } = require("../encryption/crypto");
const verifyToken = require("../middleware/auth");
const { logAudit } = require("../utils/auditLogger");

/* ================= GET ADMINS ================= */
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT AdminID, Firstname, Lastname, username, CreatedAt
      FROM Admin
      ORDER BY CreatedAt DESC
    `);

    const data = rows.map((row) => ({
      adminID: row.AdminID,
      username: decrypt(row.username),
      fullname: decrypt(row.Firstname) + " " + decrypt(row.Lastname),
      createdAt: row.CreatedAt,
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ================= CREATE ADMIN ================= */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, username, password } = req.body;

    if (!firstName || !lastName || !username || !password) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const adminID = req.user.userId;

    const hashedPassword = await bcrypt.hash(
      password + process.env.BCRYPT_PEPPER,
      12,
    );

    await pool.query(
      `
      INSERT INTO Admin
      (Firstname, Lastname, username, password, CreatedAt)
      VALUES (?, ?, ?, ?, NOW())
      `,
      [
        encrypt(firstName),
        encrypt(lastName),
        encrypt(username),
        hashedPassword,
      ],
    );

    const logPrefix = `[${username}] ${firstName} ${lastName}: `;

    await logAudit({
      location: "Admin Account",
      action: "Create Admin",
      adminID,
      details: `${logPrefix}Admin account created`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

/* ================= GET SINGLE ADMIN ================= */
router.get("/:username", async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM Admin`);

    const admin = rows.find((a) => decrypt(a.username) === req.params.username);

    if (!admin) return res.status(404).json({ message: "Not found" });

    res.json({
      admin: {
        adminID: admin.AdminID,
        username: decrypt(admin.username),
        firstname: decrypt(admin.Firstname),
        lastname: decrypt(admin.Lastname),
        createdAt: admin.CreatedAt,
        modifiedAt: admin.ModifiedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ================= UPDATE ADMIN ================= */
router.put("/:username", verifyToken, async (req, res) => {
  try {
    const { username } = req.params;
    const { newUsername, firstName, lastName } = req.body;

    const adminID = req.user.userId;

    const [rows] = await pool.query(`SELECT * FROM Admin`);

    const admin = rows.find((a) => decrypt(a.username) === username);

    if (!admin) return res.status(404).json({ message: "Not found" });

    const oldUsername = decrypt(admin.username);
    const oldFirst = decrypt(admin.Firstname);
    const oldLast = decrypt(admin.Lastname);

    const logPrefix = `[${oldUsername}] ${oldFirst} ${oldLast}: `;

    await pool.query(
      `
      UPDATE Admin
      SET username = ?, Firstname = ?, Lastname = ?, ModifiedAt = NOW()
      WHERE AdminID = ?
      `,
      [
        encrypt(newUsername),
        encrypt(firstName),
        encrypt(lastName),
        admin.AdminID,
      ],
    );

    const changes = [];

    if (oldUsername !== newUsername)
      changes.push(
        `${logPrefix}Username changed from ${oldUsername} to ${newUsername}`,
      );

    if (oldFirst !== firstName)
      changes.push(
        `${logPrefix}Firstname changed from ${oldFirst} to ${firstName}`,
      );

    if (oldLast !== lastName)
      changes.push(
        `${logPrefix}Lastname changed from ${oldLast} to ${lastName}`,
      );

    for (const change of changes) {
      await logAudit({
        location: "Admin Account",
        action: "Edit Admin",
        adminID,
        details: change,
      });
    }

    res.json({ message: "Updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ================= CHANGE PASSWORD ================= */
router.put("/:username/password", verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    const { username } = req.params;
    const adminID = req.user.userId;

    const [rows] = await pool.query(`SELECT * FROM Admin`);

    const admin = rows.find((a) => decrypt(a.username) === username);

    if (!admin) return res.status(404).json({ message: "Not found" });

    const logPrefix = `[${decrypt(admin.username)}] ${decrypt(admin.Firstname)} ${decrypt(admin.Lastname)}: `;

    const hashed = await bcrypt.hash(password + process.env.BCRYPT_PEPPER, 12);

    await pool.query(
      `
      UPDATE Admin
      SET password = ?, ModifiedAt = NOW()
      WHERE AdminID = ?
      `,
      [hashed, admin.AdminID],
    );

    await logAudit({
      location: "Admin Account",
      action: "Change Password",
      adminID,
      details: `${logPrefix}Password was changed`,
    });

    res.json({ message: "Password updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
