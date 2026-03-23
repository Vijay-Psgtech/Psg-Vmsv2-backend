/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EMAIL SERVICE - FIXED WITH PORT FALLBACK
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ Tries port 587 (TLS) first, falls back to 465 (SSL), then 25
 * ✅ EACCES = port blocked by firewall/antivirus — auto-retries next port
 * ✅ All email functions preserved
 */

import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// ═══════════════════════════════════════════════════════════════════════════
// PORT CONFIGS TO TRY IN ORDER
// ═══════════════════════════════════════════════════════════════════════════

const SMTP_CONFIGS = [
  {
    port: 587,
    secure: false,
    label: "587 (TLS/STARTTLS)",
  },
  {
    port: 465,
    secure: true,
    label: "465 (SSL)",
  },
  {
    port: 2525,
    secure: false,
    label: "2525 (TLS fallback)",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-DETECT WORKING PORT
// ═══════════════════════════════════════════════════════════════════════════

async function createWorkingTransporter() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.error("❌ SMTP_USER or SMTP_PASS missing in .env");
    return null;
  }

  for (const config of SMTP_CONFIGS) {
    try {
      console.log(`📧 Trying SMTP port ${config.label}...`);

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: config.port,
        secure: config.secure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        // ✅ If TLS, use STARTTLS upgrade
        ...(config.secure === false && {
          tls: {
            ciphers: "SSLv3",
            rejectUnauthorized: false,
          },
        }),
        connectionTimeout: 10000,
        greetingTimeout: 8000,
        socketTimeout: 15000,
      });

      // Test the connection
      await transporter.verify();

      console.log(`✅ SMTP connected on port ${config.label}`);
      console.log(`   From: ${process.env.SENDER_EMAIL || smtpUser}`);
      return transporter;
    } catch (err) {
      if (err.code === "EACCES") {
        console.warn(`⚠️  Port ${config.port} blocked (EACCES) — trying next...`);
      } else if (err.code === "ECONNREFUSED") {
        console.warn(`⚠️  Port ${config.port} refused — trying next...`);
      } else if (err.code === "ETIMEDOUT") {
        console.warn(`⚠️  Port ${config.port} timed out — trying next...`);
      } else {
        console.warn(`⚠️  Port ${config.port} failed: ${err.message} — trying next...`);
      }
    }
  }

  // All ports failed
  console.error("❌ All SMTP ports failed. Email sending will be disabled.");
  console.error("   Possible causes:");
  console.error("   1. Windows Firewall blocking outbound SMTP — allow Node.js");
  console.error("   2. Antivirus blocking SMTP — add exception for Node.js");
  console.error("   3. Corporate/university network blocking all SMTP ports");
  console.error("   4. Wrong Gmail App Password — generate new one at:");
  console.error("      https://myaccount.google.com/apppasswords");
  console.error("   5. 2FA not enabled on Gmail (required for App Passwords)");
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZE TRANSPORTER
// ═══════════════════════════════════════════════════════════════════════════

// We store the transporter in a promise so we only init once
let _transporterPromise = null;

async function getTransporter() {
  if (!_transporterPromise) {
    _transporterPromise = createWorkingTransporter();
  }
  return _transporterPromise;
}

// Kick off connection attempt on server start (non-blocking)
getTransporter();

// ═══════════════════════════════════════════════════════════════════════════
// SEND EMAIL - BASE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export async function sendEmail({ to, subject, html, text, attachments = [] }) {
  try {
    if (!to) throw new Error("Recipient email (to) is required");

    const transporter = await getTransporter();

    if (!transporter) {
      console.warn(`⚠️  Email skipped (no SMTP connection): ${subject} → ${to}`);
      return false;
    }

    const mailOptions = {
      from: `"${process.env.SENDER_NAME || "VPASS"}" <${process.env.SENDER_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️  Email sent → ${to} (ID: ${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`❌ Email failed → ${to}: ${err.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// APPROVAL EMAIL
// ═══════════════════════════════════════════════════════════════════════════

export async function sendApprovalEmail({
  visitorEmail,
  visitorName,
  hostName,
  gateNumber,
  duration,
  allowedUntil,
  qrCodeDataURL,
  customMessage,
}) {
  try {
    if (!visitorEmail || !visitorName) {
      throw new Error("Visitor email and name are required");
    }

    // ── Convert base64 data URL → CID inline attachment ──────────────
    // Gmail and most clients block data: URLs in email HTML.
    // Nodemailer's CID attachment embeds the image as a MIME part
    // and references it with cid: so it renders in every client.
    const CID = "qrcode@vpass";
    let qrAttachment = null;
    let qrImgTag = `<p style="color:#666;font-size:13px">QR Code will be available at gate</p>`;

    if (qrCodeDataURL) {
      // Strip the "data:image/png;base64," prefix to get raw base64
      const base64Data = qrCodeDataURL.replace(/^data:image\/\w+;base64,/, "");
      qrAttachment = {
        filename: "qrcode.png",
        content: base64Data,
        encoding: "base64",
        cid: CID,          // same cid referenced in <img src="cid:...">
      };
      qrImgTag = `<img src="cid:${CID}" alt="QR Code" width="200" height="200"
          style="display:block;margin:auto;border-radius:8px;background:white;
                 padding:10px;border:2px solid #3b82f6"/>`;
    }

    const customMsgBlock = customMessage ? `
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-left:4px solid #0ea5e9;
                  border-radius:8px;padding:16px;margin-bottom:20px">
        <p style="margin:0 0 6px 0;font-weight:bold;color:#0c4a6e;font-size:13px">
          💬 Message from ${hostName || "your host"}:
        </p>
        <p style="margin:0;color:#1e3a5f;font-size:14px;line-height:1.6">${customMessage}</p>
      </div>` : "";

    const html = `
    <div style="font-family:Arial,sans-serif;background:#f4f4f4;padding:30px;margin:0">
      <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">

        <div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:30px;color:white;text-align:center">
          <h1 style="margin:0;font-size:28px;font-weight:bold">✅ Visit Approved</h1>
          <p style="margin:10px 0 0 0;font-size:16px;opacity:0.9">Your VPASS entry has been confirmed</p>
        </div>

        <div style="padding:30px">
          <p style="margin:0 0 20px 0;font-size:16px;color:#333">Hello <strong>${visitorName}</strong>,</p>

          <p style="margin:0 0 25px 0;font-size:15px;color:#555;line-height:1.6">
            Your visit request has been <strong style="color:#10b981">APPROVED</strong>!
            Please find your QR code below and present it at the gate for entry.
          </p>

          ${customMsgBlock}

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:25px">
            <table style="width:100%;font-size:14px">
              <tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:12px;font-weight:600;color:#666;width:40%">Host:</td>
                <td style="padding:12px;color:#333">${hostName || "N/A"}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:12px;font-weight:600;color:#666">Gate:</td>
                <td style="padding:12px;color:#333">Gate ${gateNumber || "N/A"}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:12px;font-weight:600;color:#666">Duration:</td>
                <td style="padding:12px;color:#333">${duration || "N/A"} minutes</td>
              </tr>
              <tr>
                <td style="padding:12px;font-weight:600;color:#666">Valid Until:</td>
                <td style="padding:12px;font-weight:600;color:#10b981">
                  ${allowedUntil ? new Date(allowedUntil).toLocaleString() : "N/A"}
                </td>
              </tr>
            </table>
          </div>

          <div style="text-align:center;margin:30px 0;padding:25px;background:#f0f9ff;border-radius:8px;border-left:4px solid #3b82f6">
            <p style="margin:0 0 15px 0;color:#666;font-size:13px;text-transform:uppercase;letter-spacing:1px">
              📱 Scan at Gate
            </p>
            ${qrImgTag}
            <p style="margin:15px 0 0 0;font-size:12px;color:#666">
              Keep this email or screenshot the QR code for entry
            </p>
          </div>

          <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:15px;margin-bottom:25px">
            <p style="margin:0 0 10px 0;font-weight:bold;color:#92400e;font-size:14px">📍 Check-in Instructions:</p>
            <ul style="margin:10px 0;padding-left:20px;color:#333;font-size:13px;line-height:1.6">
              <li>Present your QR code at Gate ${gateNumber || "assigned gate"}</li>
              <li>Your visit is valid for <strong>${duration || "N/A"} minutes</strong></li>
              <li>Contact <strong>${hostName || "your host"}</strong> for access issues</li>
            </ul>
          </div>

          <p style="margin:20px 0 0 0;font-size:12px;color:#999;text-align:center;line-height:1.6">
            This is an automated notification from VPASS.<br>Please do not reply to this email.
          </p>
        </div>

        <div style="background:#f3f4f6;padding:20px;text-align:center;font-size:11px;color:#666;border-top:1px solid #e5e7eb">
          <p style="margin:0">© ${new Date().getFullYear()} VPASS. All rights reserved.</p>
        </div>
      </div>
    </div>`;

    return await sendEmail({
      to: visitorEmail,
      subject: `✅ Your Visit is Approved - VPASS`,
      html,
      text: `Your visit has been approved. Valid for ${duration} minutes until ${allowedUntil ? new Date(allowedUntil).toLocaleString() : "N/A"}`,
      attachments: qrAttachment ? [qrAttachment] : [],
    });
  } catch (err) {
    console.error(`❌ sendApprovalEmail failed: ${err.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REJECTION EMAIL
// ═══════════════════════════════════════════════════════════════════════════

export async function sendRejectionEmail({
  visitorEmail,
  visitorName,
  rejectionReason,
}) {
  try {
    if (!visitorEmail || !visitorName) {
      throw new Error("Visitor email and name are required");
    }

    const html = `
    <div style="font-family:Arial,sans-serif;background:#f4f4f4;padding:30px;margin:0">
      <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">

        <div style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);padding:30px;color:white;text-align:center">
          <h1 style="margin:0;font-size:28px;font-weight:bold">❌ Request Not Approved</h1>
        </div>

        <div style="padding:30px">
          <p style="margin:0 0 20px 0;font-size:16px;color:#333">Hello <strong>${visitorName}</strong>,</p>

          <p style="margin:0 0 25px 0;font-size:15px;color:#555;line-height:1.6">
            Unfortunately, your visit request has been <strong style="color:#ef4444">NOT APPROVED</strong>.
          </p>

          <div style="background:#fee2e2;border:2px solid #ef4444;border-radius:8px;padding:20px;margin-bottom:25px">
            <p style="margin:0 0 10px 0;font-weight:bold;color:#7f1d1d;font-size:14px">⚠️ Reason:</p>
            <p style="margin:0;color:#333;font-size:15px;line-height:1.6">${rejectionReason || "No reason provided"}</p>
          </div>

          <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:15px;margin-bottom:25px">
            <p style="margin:0;font-size:13px;color:#333;line-height:1.6">
              If you have questions, please contact the reception desk or reach out to your host directly.
            </p>
          </div>

          <p style="margin:20px 0 0 0;font-size:12px;color:#999;text-align:center;line-height:1.6">
            This is an automated notification from VPASS.<br>Please do not reply to this email.
          </p>
        </div>

        <div style="background:#f3f4f6;padding:20px;text-align:center;font-size:11px;color:#666;border-top:1px solid #e5e7eb">
          <p style="margin:0">© ${new Date().getFullYear()} VPASS. All rights reserved.</p>
        </div>
      </div>
    </div>`;

    return await sendEmail({
      to: visitorEmail,
      subject: `❌ Your Visit Request - Not Approved`,
      html,
      text: `Your visit request has been rejected. Reason: ${rejectionReason || "No reason provided"}`,
    });
  } catch (err) {
    console.error(`❌ sendRejectionEmail failed: ${err.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HOST NOTIFICATION EMAIL
// ═══════════════════════════════════════════════════════════════════════════

export async function sendHostNotificationEmail({
  hostEmail,
  hostName,
  visitorName,
  visitorPhone,
  gateNumber,
  status,
  duration,
}) {
  try {
    if (!hostEmail || !hostName) {
      throw new Error("Host email and name are required");
    }

    const statusColor = status === "APPROVED" ? "#10b981" : "#3b82f6";

    const html = `
    <div style="font-family:Arial,sans-serif;background:#f4f4f4;padding:30px;margin:0">
      <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">

        <div style="background:${statusColor};padding:20px;color:white;text-align:center">
          <h2 style="margin:0;font-size:20px">📌 Visitor ${status}</h2>
        </div>

        <div style="padding:30px">
          <p>Hello <strong>${hostName}</strong>,</p>
          <p style="margin-bottom:20px;font-size:15px;color:#555">
            <strong>${visitorName}</strong> has been ${status.toLowerCase()}.
          </p>

          <div style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:20px">
            <table style="width:100%;font-size:14px">
              <tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:10px;font-weight:600;color:#666">Visitor:</td>
                <td style="padding:10px;color:#333"><strong>${visitorName}</strong></td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:10px;font-weight:600;color:#666">Phone:</td>
                <td style="padding:10px;color:#333">${visitorPhone || "N/A"}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:10px;font-weight:600;color:#666">Gate:</td>
                <td style="padding:10px;color:#333">Gate ${gateNumber || "N/A"}</td>
              </tr>
              ${status === "APPROVED" ? `
              <tr>
                <td style="padding:10px;font-weight:600;color:#666">Duration:</td>
                <td style="padding:10px;color:#333">${duration || "N/A"} minutes</td>
              </tr>` : ""}
            </table>
          </div>

          <p style="color:#999;font-size:12px;margin-top:30px;text-align:center">
            This is an automated notification from VPASS.
          </p>
        </div>
      </div>
    </div>`;

    return await sendEmail({
      to: hostEmail,
      subject: `📌 Visitor ${status} - VPASS`,
      html,
      text: `${visitorName} has been ${status.toLowerCase()} at Gate ${gateNumber}`,
    });
  } catch (err) {
    console.error(`❌ sendHostNotificationEmail failed: ${err.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OTP EMAIL
// ═══════════════════════════════════════════════════════════════════════════

export async function sendOtpEmail(email, otp) {
  try {
    if (!email) throw new Error("Email is required");

    const html = `
    <div style="font-family:Arial;background:#f4f4f4;padding:30px">
      <div style="max-width:600px;margin:auto;background:white;border-radius:8px;padding:30px">
        <h2 style="color:#333;text-align:center">VPASS Login Verification</h2>
        <p>Hello,</p>
        <p>Your One Time Password is:</p>
        <div style="font-size:34px;font-weight:bold;letter-spacing:8px;text-align:center;padding:20px;background:#f2f5ff;border-radius:8px;color:#3f51b5">
          ${otp}
        </div>
        <p style="margin-top:20px">This OTP will expire in <b>10 minutes</b>.</p>
        <p style="color:#999;font-size:12px;margin-top:30px">
          If you did not request this login, ignore this email.
        </p>
      </div>
    </div>`;

    return await sendEmail({
      to: email,
      subject: "🔐 Your OTP - VPASS Login",
      html,
      text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
    });
  } catch (err) {
    console.error(`❌ sendOtpEmail failed: ${err.message}`);
    return false;
  }
}

// Named export for transporter (if needed elsewhere)
export const transporter = {
  sendMail: async (opts) => {
    const t = await getTransporter();
    if (!t) throw new Error("No SMTP transporter available");
    return t.sendMail(opts);
  },
};

export default {
  transporter,
  sendEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendHostNotificationEmail,
  sendOtpEmail,
};