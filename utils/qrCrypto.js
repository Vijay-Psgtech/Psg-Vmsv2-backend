import crypto from "crypto";


const SECRET = process.env.QR_SECRET;


export function encryptQR(data) {
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv(
"aes-256-cbc",
Buffer.from(SECRET),
iv
);


let encrypted = cipher.update(JSON.stringify(data));
encrypted = Buffer.concat([encrypted, cipher.final()]);


return iv.toString("hex") + ":" + encrypted.toString("hex");
}


export function decryptQR(text) {
const [ivHex, encryptedHex] = text.split(":");


const decipher = crypto.createDecipheriv(
"aes-256-cbc",
Buffer.from(SECRET),
Buffer.from(ivHex, "hex")
);


let decrypted = decipher.update(Buffer.from(encryptedHex, "hex"));
decrypted = Buffer.concat([decrypted, decipher.final()]);


return JSON.parse(decrypted.toString());
}