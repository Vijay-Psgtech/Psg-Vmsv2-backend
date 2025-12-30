

// utils/mailer.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

/**
 * Create Gmail transporter with proper configuration
 * Using App Password method (recommended for production)
 */
export const transporter = nodemailer.createTransport({
  service: 'gmail', // ✅ Use service instead of host
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
});

/**
 * Alternative configuration if the above doesn't work
 * Uncomment this and comment out the above
 */

/**
 * Verify SMTP connection on startup
 */
transporter.verify((err, success) => {
  if (err) {
    console.error("❌ SMTP NOT READY:", err.message);
    console.error("\n📋 TROUBLESHOOTING STEPS:");
    console.error("1. Enable 2-Step Verification in your Google Account");
    console.error("2. Generate App Password: https://myaccount.google.com/apppasswords");
    console.error("3. Use the 16-character App Password in SMTP_PASS");
    console.error("4. Make sure SMTP_USER is your full Gmail address\n");
  } else {
    console.log("✅ Mail server ready (Gmail SMTP connected)");
  }
});

/**
 * Send test email
 */
export async function sendTestEmail(toEmail) {
  try {
    const info = await transporter.sendMail({
      from: `"Visitor Management System" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "✅ Test Email - VMS System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">✅ Email Configuration Test</h2>
          <p>Your SMTP configuration is working correctly.</p>
          <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            This is an automated test email from VPASS Visitor Management System
          </p>
        </div>
      `,
    });

    console.log("✅ Test email sent successfully");
    console.log("Message ID:", info.messageId);
    return true;
  } catch (err) {
    console.error("❌ Test email failed:", err.message);
    return false;
  }
}

/**
 * Visitor check-in notification
 */
export async function sendCheckInNotification(visitor) {
  try {
    const info = await transporter.sendMail({
      from: `"VPASS - Visitor Management" <${process.env.EMAIL_USER}>`,
      to: [visitor.hostEmail, visitor.email].filter(Boolean).join(','),
      subject: `🚪 Visitor Checked In - ${visitor.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
          <h2 style="color: #2196F3; border-bottom: 2px solid #2196F3; padding-bottom: 10px;">
            🚪 Visitor Checked In
          </h2>
          <table style="width: 100%; margin-top: 20px;">
            <tr>
              <td style="padding: 8px; font-weight: bold;">Name:</td>
              <td style="padding: 8px;">${visitor.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Visitor ID:</td>
              <td style="padding: 8px;">${visitor.visitorId}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Gate:</td>
              <td style="padding: 8px;">${visitor.gate || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Check-in Time:</td>
              <td style="padding: 8px;">${new Date(visitor.checkInTime).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Valid Until:</td>
              <td style="padding: 8px;">${new Date(visitor.allowedUntil).toLocaleString()}</td>
            </tr>
          </table>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px; text-align: center;">
            VPASS Visitor Management System - Automated Notification
          </p>
        </div>
      `,
    });

    console.log("✅ Check-in notification sent:", info.messageId);
    return true;
  } catch (err) {
    console.error("❌ Check-in notification failed:", err.message);
    return false;
  }
}

/**
 * Visitor check-out notification
 */
export async function sendCheckOutNotification(visitor) {
  try {
    const duration = visitor.actualDuration || 0;
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    const durationText = hours > 0 
      ? `${hours}h ${minutes}m` 
      : `${minutes} minutes`;

    const info = await transporter.sendMail({
      from: `"VPASS - Visitor Management" <${process.env.EMAIL_USER}>`,
      to: [visitor.hostEmail, visitor.email].filter(Boolean).join(','),
      subject: `👋 Visitor Checked Out - ${visitor.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
          <h2 style="color: #4CAF50; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
            👋 Visitor Checked Out
          </h2>
          <table style="width: 100%; margin-top: 20px;">
            <tr>
              <td style="padding: 8px; font-weight: bold;">Name:</td>
              <td style="padding: 8px;">${visitor.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Visitor ID:</td>
              <td style="padding: 8px;">${visitor.visitorId}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Check-in:</td>
              <td style="padding: 8px;">${new Date(visitor.checkInTime).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Check-out:</td>
              <td style="padding: 8px;">${new Date(visitor.checkOutTime).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Duration:</td>
              <td style="padding: 8px; color: #4CAF50; font-weight: bold;">${durationText}</td>
            </tr>
          </table>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px; text-align: center;">
            VPASS Visitor Management System - Automated Notification
          </p>
        </div>
      `,
    });

    console.log("✅ Check-out notification sent:", info.messageId);
    return true;
  } catch (err) {
    console.error("❌ Check-out notification failed:", err.message);
    return false;
  }
}

/**
 * Overstay alert
 */
export async function sendOverstayAlert(visitor, overstayMinutes) {
  try {
    const securityEmail = process.env.SECURITY_EMAIL || "security@company.com";
    
    const info = await transporter.sendMail({
      from: `"VPASS - Security Alert" <${process.env.EMAIL_USER}>`,
      to: [securityEmail, visitor.hostEmail].filter(Boolean).join(','),
      subject: `⚠️ URGENT: Overstay Alert - ${visitor.name} (${overstayMinutes} min)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 3px solid #f44336; border-radius: 8px; padding: 20px; background-color: #fff3f3;">
          <h2 style="color: #f44336; text-align: center; margin-bottom: 20px;">
            ⚠️ OVERSTAY ALERT
          </h2>
          <div style="background: white; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px; font-weight: bold;">Visitor:</td>
                <td style="padding: 8px;">${visitor.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Visitor ID:</td>
                <td style="padding: 8px;">${visitor.visitorId}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Phone:</td>
                <td style="padding: 8px;">${visitor.phone}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Host:</td>
                <td style="padding: 8px;">${visitor.host}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Gate:</td>
                <td style="padding: 8px;">${visitor.gate || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Check-in:</td>
                <td style="padding: 8px;">${new Date(visitor.checkInTime).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Allowed Until:</td>
                <td style="padding: 8px;">${new Date(visitor.allowedUntil).toLocaleString()}</td>
              </tr>
              <tr style="background-color: #ffebee;">
                <td style="padding: 8px; font-weight: bold; color: #f44336;">Overstay Duration:</td>
                <td style="padding: 8px; font-weight: bold; color: #f44336; font-size: 16px;">
                  ${overstayMinutes} minutes
                </td>
              </tr>
            </table>
          </div>
          <div style="background: #f44336; color: white; padding: 15px; border-radius: 5px; text-align: center;">
            <strong>⚠️ IMMEDIATE ACTION REQUIRED</strong>
            <p style="margin: 10px 0 0 0;">Please contact the visitor and verify their status.</p>
          </div>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px; text-align: center;">
            VPASS Security Alert System - Automated Notification
          </p>
        </div>
      `,
    });

    console.log(`✅ Overstay alert sent (${visitor.visitorId}):`, info.messageId);
    return true;
  } catch (err) {
    console.error("❌ Overstay alert failed:", err.message);
    return false;
  }
}

export default {
  transporter,
  sendTestEmail,
  sendCheckInNotification,
  sendCheckOutNotification,
  sendOverstayAlert,
};