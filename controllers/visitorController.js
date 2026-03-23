import QRCode from "qrcode";
import Visitor from "../models/Visitor.js";
import Notification from "../models/Notification.js";
import { sendEmail } from "../utils/mailer.js";
import { encryptQR } from "../utils/qrCrypto.js";

/**
 * ✅ COMPLETE VISITOR APPROVAL ENDPOINT
 * - Updates visitor status to APPROVED
 * - Generates QR code with encrypted data
 * - Sends approval email with QR code
 * - Creates notification for host
 * - Handles error recovery
 */

export const approveVisitor = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, expectedDuration = 120, reason } = req.body;
    const adminId = req.user._id;

    // ── Validate input ────────────────────────────────────────────
    if (!id) {
      return res.status(400).json({ message: "Visitor ID required" });
    }

    if (action !== "APPROVED" && action !== "REJECTED") {
      return res.status(400).json({ message: "Invalid action" });
    }

    // ── Fetch visitor ─────────────────────────────────────────────
    const visitor = await Visitor.findById(id);
    if (!visitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }

    if (visitor.status !== "PENDING") {
      return res.status(400).json({
        message: `Cannot ${action} visitor with status ${visitor.status}`,
      });
    }

    // ── APPROVAL FLOW ─────────────────────────────────────────────
    if (action === "APPROVED") {
      const allowedUntil = new Date(Date.now() + expectedDuration * 60000);

      visitor.status = "APPROVED";
      visitor.expectedDuration = expectedDuration;
      visitor.allowedUntil = allowedUntil;
      visitor.approvedAt = new Date();
      visitor.approvedBy = adminId;

      await visitor.save();

      // ── Generate QR Code ──────────────────────────────────────
      const qrData = {
        visitorId: visitor._id.toString(),
        name: visitor.name,
        phone: visitor.phone,
        host: visitor.host,
        gate: visitor.gate,
        generatedAt: new Date().toISOString(),
        allowedUntil: allowedUntil.toISOString(),
      };

      // Encrypt QR data for security
      const encryptedQR = encryptQR(qrData);

      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(encryptedQR, {
  width: 280,
  margin: 2,
  errorCorrectionLevel: "H"
});

      // ── Send Email to Visitor ────────────────────────────────
      const emailHtml = `
      <div style="font-family:Arial;background:#f4f4f4;padding:30px">
        <div style="max-width:600px;margin:auto;background:white;border-radius:8px;padding:30px">
          
          <h2 style="color:#333;text-align:center">
            ✅ Visit Approval Confirmed
          </h2>

          <p>Hello <strong>${visitor.name}</strong>,</p>

          <p>Your visit request has been <strong style="color:#10b981">APPROVED</strong>!</p>

          <!-- Visitor Details -->
          <div style="background:#f9fafb;padding:15px;border-radius:8px;margin:20px 0">
            <table style="width:100%;font-size:14px">
              <tr>
                <td style="padding:8px;font-weight:bold;color:#666">Host:</td>
                <td style="padding:8px">${visitor.host}</td>
              </tr>
              <tr>
                <td style="padding:8px;font-weight:bold;color:#666">Gate:</td>
                <td style="padding:8px">Gate ${visitor.gate}</td>
              </tr>
              <tr>
                <td style="padding:8px;font-weight:bold;color:#666">Duration:</td>
                <td style="padding:8px">${expectedDuration} minutes</td>
              </tr>
              <tr>
                <td style="padding:8px;font-weight:bold;color:#666">Valid Until:</td>
                <td style="padding:8px">${allowedUntil.toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <!-- QR Code -->
          <div style="text-align:center;margin:30px 0">
            <p style="color:#666;font-size:12px">Scan this QR code at the gate:</p>
            <img src="${qrCodeDataURL}" alt="QR Code" style="max-width:200px;border-radius:8px" />
          </div>

          <!-- Instructions -->
          <div style="background:#e3f2fd;padding:15px;border-radius:8px;border-left:4px solid #3b82f6">
            <p style="margin:0;font-weight:bold;color:#1976d2">📍 Instructions:</p>
            <ul style="margin:10px 0;padding-left:20px;color:#333">
              <li>Present your QR code at the gate or to security</li>
              <li>Your visit is valid for ${expectedDuration} minutes</li>
              <li>Checkout automatically after duration expires</li>
              <li>Contact ${visitor.host} for any access issues</li>
            </ul>
          </div>

          <p style="color:#999;font-size:12px;margin-top:30px">
            This is an automated notification from VPASS Visitor Management System.
          </p>

        </div>
      </div>
      `;

      const emailSent = await sendEmail({
        to: visitor.email,
        subject: `✅ Your Visit is Approved - VPASS`,
        html: emailHtml,
        text: `Your visit has been approved. Your QR code is attached. Valid until ${allowedUntil.toLocaleString()}`,
      });

      if (!emailSent) {
        console.error(`⚠️ Failed to send approval email to ${visitor.email}`);
        // Don't fail the entire request, but log it
      }

      // ── Create notification for host ──────────────────────────
      try {
        await Notification.create({
          recipientId: visitor.hostId, // Assuming you have hostId in visitor
          recipientRole: "host",
          title: "Visitor Approved",
          message: `${visitor.name} has been approved and is awaiting check-in at Gate ${visitor.gate}`,
          severity: "MEDIUM",
          meta: {
            visitorId: visitor._id,
            visitorName: visitor.name,
            gate: visitor.gate,
          },
        });
      } catch (notifErr) {
        console.error("⚠️ Failed to create host notification:", notifErr.message);
      }

      console.log(`✅ Visitor ${visitor.name} approved. Email sent to ${visitor.email}`);

      return res.json({
        message: "Visitor approved successfully",
        visitor,
        qrCode: qrCodeDataURL, // Return QR code to frontend
        encryptedQR, // For storage if needed
        allowedUntil,
      });
    }

    // ── REJECTION FLOW ────────────────────────────────────────────
    if (action === "REJECTED") {
      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "Rejection reason required" });
      }

      visitor.status = "REJECTED";
      visitor.rejectionReason = reason;
      visitor.rejectedAt = new Date();
      visitor.rejectedBy = adminId;

      await visitor.save();

      // ── Send Rejection Email ──────────────────────────────────
      const rejectEmailHtml = `
      <div style="font-family:Arial;background:#f4f4f4;padding:30px">
        <div style="max-width:600px;margin:auto;background:white;border-radius:8px;padding:30px">
          
          <h2 style="color:#333;text-align:center">
            ❌ Visit Request Not Approved
          </h2>

          <p>Hello <strong>${visitor.name}</strong>,</p>

          <p>Unfortunately, your visit request has been <strong style="color:#ef4444">NOT APPROVED</strong>.</p>

          <div style="background:#fee;padding:15px;border-radius:8px;border-left:4px solid #ef4444;margin:20px 0">
            <p style="margin:0;font-weight:bold;color:#dc2626">Reason:</p>
            <p style="margin:10px 0;color:#333">${reason}</p>
          </div>

          <p>If you have questions, please contact the reception desk.</p>

          <p style="color:#999;font-size:12px;margin-top:30px">
            This is an automated notification from VPASS Visitor Management System.
          </p>

        </div>
      </div>
      `;

      const rejectEmailSent = await sendEmail({
        to: visitor.email,
        subject: "❌ Your Visit Request - Not Approved",
        html: rejectEmailHtml,
        text: `Your visit request has been rejected. Reason: ${reason}`,
      });

      if (!rejectEmailSent) {
        console.error(`⚠️ Failed to send rejection email to ${visitor.email}`);
      }

      console.log(`✅ Visitor ${visitor.name} rejected. Email sent to ${visitor.email}`);

      return res.json({
        message: "Visitor rejected successfully",
        visitor,
      });
    }
  } catch (error) {
    console.error("❌ Approval error:", error);
    res.status(500).json({
      message: error.message || "Failed to process visitor approval",
      error: error.message,
    });
  }
};

export default { approveVisitor };

