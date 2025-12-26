import crypto from "crypto";

/* Convert base64 → buffer */
function base64ToBuffer(base64) {
  const data = base64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(data, "base64");
}

/* Simple perceptual hash */
export async function hashFace(base64Image) {
  const buffer = base64ToBuffer(base64Image);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/* Compare hashes */
export function compareFace(hash1, hash2) {
  if (!hash1 || !hash2) return false;
  return hash1 === hash2;
}
