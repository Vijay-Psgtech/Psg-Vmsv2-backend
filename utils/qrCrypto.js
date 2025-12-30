import crypto from "crypto";

export function encryptQR(data) {
  const QR_SECRET = process.env.QR_SECRET;
  if (!QR_SECRET) throw new Error("QR_SECRET missing");

  const iv = crypto.randomBytes(16);
  const key = Buffer.from(QR_SECRET.padEnd(32));

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");

  return `${iv.toString("hex")}:${encrypted}`;
}

export function decryptQR(payload) {
  const QR_SECRET = process.env.QR_SECRET;
  if (!QR_SECRET) throw new Error("QR_SECRET missing");

  const [ivHex, encryptedHex] = payload.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const encryptedText = Buffer.from(encryptedHex, "hex");

  const key = Buffer.from(QR_SECRET.padEnd(32));
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}