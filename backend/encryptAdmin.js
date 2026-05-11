require("dotenv").config();
const sql = require("mssql");
const { encrypt, decrypt } = require("./encryption/crypto");

// DB CONFIG (same as server.js)
const config = {
  user: process.env.CONFIG_USER,
  password: process.env.CONFIG_PASSWORD,
  server: process.env.CONFIG_SERVER,
  database: process.env.CONFIG_DATABASE,
  options: {
    trustServerCertificate: true,
  },
};

// helper: check if already encrypted
function isEncrypted(value) {
  return typeof value === "string" && value.includes(":");
}

async function encryptAdmins() {
  try {
    const pool = await sql.connect(config);

    console.log("Connected to DB...");

    // GET ALL ADMINS
    const result = await pool.request().query(`
      SELECT AdminID, Firstname, Lastname, username
      FROM Admin
    `);

    const admins = result.recordset;

    console.log(`Found ${admins.length} admins`);

    for (const admin of admins) {
      const { AdminID, Firstname, Lastname, username } = admin;

      // skip if already encrypted
      if (
        isEncrypted(Firstname) &&
        isEncrypted(Lastname) &&
        isEncrypted(username)
      ) {
        console.log(`Skipping AdminID ${AdminID} (already encrypted)`);
        continue;
      }

      const encryptedFirstname = isEncrypted(Firstname)
        ? Firstname
        : encrypt(Firstname);

      const encryptedLastname = isEncrypted(Lastname)
        ? Lastname
        : encrypt(Lastname);

      const encryptedUsername = isEncrypted(username)
        ? username
        : encrypt(username);

      // UPDATE DB
      await pool
        .request()
        .input("AdminID", sql.Int, AdminID)
        .input("Firstname", sql.NVarChar(sql.MAX), encryptedFirstname)
        .input("Lastname", sql.NVarChar(sql.MAX), encryptedLastname)
        .input("username", sql.NVarChar(sql.MAX), encryptedUsername)
        .query(`
          UPDATE Admin
          SET Firstname = @Firstname,
              Lastname = @Lastname,
              username = @username
          WHERE AdminID = @AdminID
        `);

      console.log(`Encrypted AdminID ${AdminID}`);
    }

    console.log("✅ Encryption complete!");
    process.exit();
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

encryptAdmins();