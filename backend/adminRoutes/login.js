const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middleware/auth");
const { encrypt, decrypt } = require("../encryption/crypto");
const pool = require("../db"); // ✅ use MySQL pool

// POST /api/login
router.post("/", async (req, res) => {
  const { username, password } = req.body;

  try {
    // ✅ MySQL query
    const [admins] = await pool.query("SELECT * FROM Admin");

    let user = null;

    // decrypt + find username
    for (const admin of admins) {
      const decryptedUsername = decrypt(admin.username);

      if (decryptedUsername === username) {
        user = admin;
        break;
      }
    }

    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const pepper = process.env.BCRYPT_PEPPER;

    const validPassword = await bcrypt.compare(
      password + pepper,
      user.password,
    );

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // decrypt fields
    const decryptedFirstname = decrypt(user.Firstname);
    const decryptedLastname = decrypt(user.Lastname);
    const decryptedUsername = decrypt(user.username);

    const token = jwt.sign(
      {
        userId: user.AdminID,
        username: decryptedUsername,
      },
      process.env.JWT_SECRET,
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Login successful",
      admin: {
        id: user.AdminID,
        name: `${decryptedFirstname} ${decryptedLastname}`,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET dashboard
router.get("/dashboard", verifyToken, (req, res) => {
  res.json({
    username: req.user.username,
  });
});

// LOGOUT
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });

  res.json({ message: "Logged out successfully" });
});

module.exports = router;
