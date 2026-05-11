const crypto = require("crypto");

const algorithm = "aes-256-cbc";
// Key must be 32 bytes
const key = crypto.createHash("sha256")
  .update(String(process.env.ENCRYPTION_KEY))
  .digest("base64")
  .substr(0, 32);

function encrypt(text) {
  if (!text) return null;

  const iv = crypto.randomBytes(16); // generate IV per-encryption
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted; // store iv with ciphertext
}

function decrypt(encryptedText) {
  if (!encryptedText) return null;

  if (!encryptedText.includes(":")) {
    return encryptedText; // handle plaintext rows
  }

  try {
    const [ivHex, encrypted] = encryptedText.split(":");
    const iv = Buffer.from(ivHex, "hex");

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err.message, "Value:", encryptedText);
    return encryptedText;
  }
}

module.exports = { encrypt, decrypt };