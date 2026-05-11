const express = require("express");
const router = express.Router();
const pool = require("../db"); //  use mysql pool
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const verifyRequester = require("../middleware/requesterAuth");
const { decrypt } = require("../encryption/crypto");

// POST /api/requester/login
router.post("/", async (req, res) => {
  const { username, password } = req.body;

  try {
    //  MySQL query
    const [employees] = await pool.query(`
      SELECT * FROM Employees
    `);

    let user = null;

    //  decrypt usernames to match input
    for (const emp of employees) {
      const decryptedUsername = decrypt(emp.UserName);

      if (decryptedUsername === username) {
        user = emp;
        break;
      }
    }

    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const pepper = process.env.BCRYPT_PEPPER;

    //  compare password
    const validPassword = await bcrypt.compare(
      password + pepper,
      user.Password,
    );

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const decryptedUsername = decrypt(user.UserName);
    const firstname = decrypt(user.Firstname);
    const lastname = decrypt(user.Lastname);

    const token = jwt.sign(
      {
        userId: user.EmployeeID,
        username: decryptedUsername,
        role: "requester",
      },
      process.env.JWT_SECRET,
    );

    // CLEAR OLD COOKIE
    res.clearCookie("token", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    // SET NEW COOKIE
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Login successful",
      user: {
        id: user.EmployeeID,
        firstname,
        lastname,
        username: decryptedUsername,
        division: user.DepartmentName,
      },
    });
  } catch (err) {
    console.error("Requester login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/requester/login/dashboard
router.get("/dashboard", verifyRequester, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT 
        e.Firstname,
        e.Lastname,
        e.UserName,
        d.DepartmentName
      FROM Employees e
      LEFT JOIN Departments d 
        ON e.DepartmentID = d.DepartmentID
      WHERE e.EmployeeID = ?
      `,
      [req.user.userId],
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      firstname: decrypt(user.Firstname),
      lastname: decrypt(user.Lastname),
      username: decrypt(user.UserName),
      division: user.DepartmentName,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching user" });
  }
});

// POST /api/requester/login/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  });

  res.json({ message: "Logged out successfully" });
});

module.exports = router;
