/**
 * QR CRYPTO - PRODUCTION FIXED
 * File: backend/utils/qrCrypto.js
 *
 * FIXES:
 * 1. Exports isQRTimestampValid — was missing, visitorRoutes.js imports it
 * 2. Uses crypto-js AES (matches frontend) for consistent encrypt/decrypt
 * 3. Adds proper error messages
 *
 * IMPORTANT: QR_SECRET in .env must be the same value as VITE_QR_SECRET in frontend .env
 */

import CryptoJS from "crypto-js";
import dotenv from "dotenv";
dotenv.config();

const QR_SECRET = process.env.QR_SECRET || "CHANGE_THIS_TO_32_CHAR_SECRET_KEY";

if (QR_SECRET === "CHANGE_THIS_TO_32_CHAR_SECRET_KEY") {
  console.warn("⚠️  WARNING: Using default QR_SECRET! Set QR_SECRET in .env for production.");
}

/**
 * Encrypt visitor data for QR code
 */
export function encryptQR(payload) {
  try {
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid QR payload — must be an object");
    }

    const data = JSON.stringify({
      ...payload,
      ts: payload.ts || Date.now(), // anti-replay timestamp
    });

    const encrypted = CryptoJS.AES.encrypt(data, QR_SECRET).toString();
    return encrypted;
  } catch (err) {
    console.error("❌ QR encryption failed:", err.message);
    throw new Error(`QR encryption failed: ${err.message}`);
  }
}

/**
 * Decrypt QR code string back to visitor data
 */
export function decryptQR(encrypted) {
  try {
    if (!encrypted) throw new Error("No encrypted QR data provided");

    const bytes = CryptoJS.AES.decrypt(encrypted, QR_SECRET);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    if (!decrypted) throw new Error("Decryption resulted in empty string — wrong QR_SECRET?");

    return JSON.parse(decrypted);
  } catch (err) {
    console.error("❌ QR decryption failed:", err.message);
    throw new Error(`QR decryption failed: ${err.message}`);
  }
}

/**
 * Validate QR timestamp (anti-replay protection)
 * @param {number} timestamp - millisecond timestamp from decrypted QR payload
 * @param {number} maxAgeSeconds - default 86400 (24 hours)
 */
export function isQRTimestampValid(timestamp, maxAgeSeconds = 86400) {
  if (!timestamp) return false;
  const ageSeconds = Math.round((Date.now() - timestamp) / 1000);
  return ageSeconds <= maxAgeSeconds;
}

export default { encryptQR, decryptQR, isQRTimestampValid };