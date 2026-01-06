import express from "express";
import crypto from "crypto";
import Visitor from "../models/Visitor.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { generateBadge } from "../utils/pdf.js";
import { transporter } from "../utils/mailer.js";

const router = express.Router();

/* =========================================================
   MOCK DATA FOR FRONTEND
========================================================= */
const employees = [
  {
    _id: "1",
    name: "John Smith",
    email: "rvk.its@psgtech.ac.in",
    department: "Engineering",
  },
  {
    _id: "2",
    name: "Sarah Johnson",
    email: "sarah@company.com",
    department: "HR",
  },
  {
    _id: "3",
    name: "Michael Brown",
    email: "michael@company.com",
    department: "Sales",
  },
  {
    _id: "4",
    name: "Emily Davis",
    email: "emily@company.com",
    department: "Marketing",
  },
];

const buildings = [
  { _id: "GATE-1", name: "Main Gate - Building A" },
  { _id: "GATE-2", name: "East Gate - Building B" },
  { _id: "GATE-3", name: "West Gate - Building C" },
];

router.get("/employees", requireAuth, (req, res) => res.json(employees));
router.get("/buildings", requireAuth, (req, res) => res.json(buildings));

/* =========================================================
   PUBLIC VISITOR CREATE 🔓 (NO AUTH)
========================================================= */
router.post("/public-create", async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      company,
      purpose,
      host,
      hostEmail,
      gate,
      allowedUntil,
      expectedDuration,
      vehicleNumber,
    } = req.body;

    // Validation
    if (
      !name ||
      !phone ||
      !email ||
      !host ||
      !hostEmail ||
      !gate ||
      !allowedUntil
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Parse date
    const parsedDate = new Date(allowedUntil);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid allowedUntil date" });
    }

    // Generate approval token
    const approvalToken = crypto.randomBytes(32).toString("hex");

    // Create visitor
    const visitor = await Visitor.create({
      visitorId: `VIS-${Date.now()}`,
      name,
      phone,
      email,
      company: company || "",
      purpose: purpose || "",
      host,
      hostEmail,
      gate: String(gate),
      allowedUntil: parsedDate,
      expectedDuration: expectedDuration || 120,
      vehicleNumber: vehicleNumber || "",
      status: "PENDING",
      qrExpiresAt: parsedDate,
      approvalToken,
      approvalExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      history: [
        { action: "CREATED_PUBLIC", note: "Visitor submitted request online" },
      ],
    });

    // Send approval email to host
    await sendHostApprovalEmail(visitor);

    // Emit socket update
    if (req.io) {
      const allVisitors = await Visitor.find()
        .sort({ createdAt: -1 })
        .limit(100);
      req.io.emit("visitors:update", allVisitors);
    }

    res.status(201).json({
      success: true,
      visitorId: visitor.visitorId,
      message:
        "Visitor request submitted successfully. Awaiting host approval.",
    });
  } catch (err) {
    console.error("PUBLIC CREATE ERROR:", err);
    res.status(500).json({ message: "Failed to create visitor request" });
  }
});

/* =========================================================
   RECEPTION VISITOR CREATE
========================================================= */

router.post(
  "/create",
  requireAuth,
  requireRole("reception", "admin"),
  async (req, res) => {
    try {
      const {
        name,
        phone,
        email,
        company,
        purpose,
        host,
        hostEmail,
        gate,
        allowedUntil,
        expectedDuration,
        vehicleNumber,
      } = req.body;

      // Validation
      if (
        !name ||
        !phone ||
        !email ||
        !host ||
        !hostEmail ||
        !gate ||
        !allowedUntil
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Parse date
      const parsedDate = new Date(allowedUntil);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "Invalid allowedUntil date" });
      }

      // Generate approval token
      const approvalToken = crypto.randomBytes(32).toString("hex");

      // Create visitor
      const visitor = await Visitor.create({
        visitorId: `VIS-${Date.now()}`,
        name,
        phone,
        email,
        company: company || "",
        purpose: purpose || "",
        host,
        hostEmail,
        gate: String(gate),
        allowedUntil: parsedDate,
        expectedDuration: expectedDuration || 120,
        vehicleNumber: vehicleNumber || "",
        status: "PENDING",
        qrExpiresAt: parsedDate,
        approvalToken,
        approvalExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        history: [
          {
            action: "CREATED_RECEPTION",
            note: "Visitor created from reception Dashboard",
          },
        ],
      });

      // Send approval email to host
      await sendHostApprovalEmail(visitor);

      res.status(201).json({
        success: true,
        visitorId: visitor.visitorId,
        message:
          "Visitor request submitted successfully. Awaiting host approval.",
      });
    } catch (err) {
      res.status(500).json({ message: "Create failed" });
    }
  }
);

/* =========================================================
   SEND HOST APPROVAL EMAIL
========================================================= */
async function sendHostApprovalEmail(visitor) {
  try {
    const approveUrl = `${process.env.BASE_URL}/api/visitor/email-approve/${visitor.approvalToken}`;
    const rejectUrl = `${process.env.BASE_URL}/api/visitor/email-reject/${visitor.approvalToken}`;

    await transporter.sendMail({
      from: `"Visitor Management System" <${process.env.EMAIL_USER}>`,
      to: visitor.hostEmail,
      subject: `🔔 Visitor Approval Required - ${visitor.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; }
            .info-row { display: flex; margin: 10px 0; }
            .info-label { font-weight: bold; width: 150px; color: #6b7280; }
            .info-value { color: #111827; }
            .button-container { text-align: center; margin: 30px 0; }
            .button { display: inline-block; padding: 15px 40px; margin: 10px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
            .approve-btn { background: #10b981; color: white; }
            .reject-btn { background: #ef4444; color: white; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 Visitor Approval Required</h1>
              <p>A visitor has requested to meet with you</p>
            </div>
            
            <div class="content">
              <div class="info-box">
                <h2 style="margin-top: 0; color: #667eea;">Visitor Details</h2>
                <div class="info-row">
                  <div class="info-label">Name:</div>
                  <div class="info-value">${visitor.name}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Phone:</div>
                  <div class="info-value">${visitor.phone}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Email:</div>
                  <div class="info-value">${visitor.email}</div>
                </div>
                ${
                  visitor.company
                    ? `
                <div class="info-row">
                  <div class="info-label">Company:</div>
                  <div class="info-value">${visitor.company}</div>
                </div>
                `
                    : ""
                }
                <div class="info-row">
                  <div class="info-label">Purpose:</div>
                  <div class="info-value">${visitor.purpose}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Entry Gate:</div>
                  <div class="info-value">${visitor.gate}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Visit Date/Time:</div>
                  <div class="info-value">${new Date(
                    visitor.allowedUntil
                  ).toLocaleString()}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Duration:</div>
                  <div class="info-value">${
                    visitor.expectedDuration
                  } minutes</div>
                </div>
                ${
                  visitor.vehicleNumber
                    ? `
                <div class="info-row">
                  <div class="info-label">Vehicle:</div>
                  <div class="info-value">${visitor.vehicleNumber}</div>
                </div>
                `
                    : ""
                }
                <div class="info-row">
                  <div class="info-label">Visitor ID:</div>
                  <div class="info-value">${visitor.visitorId}</div>
                </div>
              </div>

              <div class="button-container">
                <a href="${approveUrl}" class="button approve-btn">✅ APPROVE VISITOR</a>
                <a href="${rejectUrl}" class="button reject-btn">❌ REJECT REQUEST</a>
              </div>

              <p style="color: #6b7280; font-size: 14px; text-align: center;">
                This approval link expires in 24 hours.
              </p>
            </div>
            
            <div class="footer">
              <p>This is an automated email from the Visitor Management System.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("✅ Host approval email sent to:", visitor.hostEmail);
  } catch (err) {
    console.error("❌ Failed to send host approval email:", err.message);
  }
}

/* =========================================================
   EMAIL APPROVE 🔓
========================================================= */
router.get("/email-approve/:token", async (req, res) => {
  try {
    const visitor = await Visitor.findOne({
      approvalToken: req.params.token,
      approvalExpiresAt: { $gt: new Date() },
    });

    if (!visitor) {
      return res.send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>❌ Invalid or Expired Link</h2>
            <p>This approval link has expired or is invalid.</p>
          </body>
        </html>
      `);
    }

    if (visitor.status !== "PENDING") {
      return res.send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>ℹ️ Already Processed</h2>
            <p>This visitor request has already been ${visitor.status.toLowerCase()}.</p>
          </body>
        </html>
      `);
    }

    // Approve visitor
    visitor.status = "APPROVED";
    visitor.approvedAt = new Date();
    visitor.approvalToken = null;
    visitor.history.push({
      action: "APPROVED_EMAIL",
      note: "Approved by host via email",
    });
    await visitor.save();

    // Send confirmation emails
    await sendVisitorApprovedEmail(visitor);

    res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2 style="color: #10b981;">✅ Visitor Approved Successfully!</h2>
          <p>Visitor <strong>${visitor.name}</strong> (ID: ${visitor.visitorId}) has been approved.</p>
          <p>Confirmation emails have been sent to the visitor and security team.</p>
          <p style="color: #6b7280; margin-top: 30px;">You can close this window.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Email approve error:", err);
    res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>❌ Error</h2>
          <p>An error occurred. Please try again or contact support.</p>
        </body>
      </html>
    `);
  }
});

/* =========================================================
   EMAIL REJECT 🔓
========================================================= */
router.get("/email-reject/:token", async (req, res) => {
  try {
    const visitor = await Visitor.findOne({
      approvalToken: req.params.token,
      approvalExpiresAt: { $gt: new Date() },
    });

    if (!visitor) {
      return res.send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>❌ Invalid or Expired Link</h2>
            <p>This rejection link has expired or is invalid.</p>
          </body>
        </html>
      `);
    }

    if (visitor.status !== "PENDING") {
      return res.send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>ℹ️ Already Processed</h2>
            <p>This visitor request has already been ${visitor.status.toLowerCase()}.</p>
          </body>
        </html>
      `);
    }

    // Reject visitor
    visitor.status = "REJECTED";
    visitor.rejectionReason = "Rejected by host via email";
    visitor.approvalToken = null;
    visitor.history.push({
      action: "REJECTED_EMAIL",
      note: "Rejected by host via email",
    });
    await visitor.save();

    // Send rejection email
    await sendVisitorRejectedEmail(visitor);

    res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2 style="color: #ef4444;">❌ Visitor Request Rejected</h2>
          <p>Visitor request from <strong>${visitor.name}</strong> has been rejected.</p>
          <p>A notification email has been sent to the visitor.</p>
          <p style="color: #6b7280; margin-top: 30px;">You can close this window.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Email reject error:", err);
    res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>❌ Error</h2>
          <p>An error occurred. Please try again or contact support.</p>
        </body>
      </html>
    `);
  }
});

/* =========================================================
   ADMIN APPROVE/REJECT
========================================================= */
router.post(
  "/approve/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { action, reason, expectedDuration } = req.body;
      const visitor = await Visitor.findById(req.params.id);

      if (!visitor) {
        return res.status(404).json({ message: "Visitor not found" });
      }

      if (visitor.status !== "PENDING") {
        return res.status(400).json({ message: "Visitor already processed" });
      }

      if (action === "APPROVED") {
        visitor.status = "APPROVED";
        visitor.approvedAt = new Date();
        visitor.approvedBy = req.user.id;
        visitor.approvalToken = null;

        if (expectedDuration) {
          visitor.expectedDuration = expectedDuration;
          visitor.allowedUntil = new Date(
            Date.now() + expectedDuration * 60000
          );
        }

        visitor.history.push({
          action: "APPROVED_ADMIN",
          by: req.user.id,
          note: "Approved by admin",
        });

        await visitor.save();
        await sendVisitorApprovedEmail(visitor);

        res.json({ success: true, message: "Visitor approved", visitor });
      } else if (action === "REJECTED") {
        visitor.status = "REJECTED";
        visitor.rejectionReason = reason || "Rejected by admin";
        visitor.approvalToken = null;

        visitor.history.push({
          action: "REJECTED_ADMIN",
          by: req.user.id,
          note: reason || "Rejected by admin",
        });

        await visitor.save();
        await sendVisitorRejectedEmail(visitor);

        res.json({ success: true, message: "Visitor rejected" });
      } else {
        res.status(400).json({ message: "Invalid action" });
      }

      // Emit socket update
      if (req.io) {
        req.io.emit(
          "visitors:update",
          await Visitor.find().sort({ createdAt: -1 })
        );
      }
    } catch (err) {
      console.error("Approve/reject error:", err);
      res.status(500).json({ message: "Operation failed" });
    }
  }
);

/* =========================================================
   SEND VISITOR APPROVED EMAIL
========================================================= */
async function sendVisitorApprovedEmail(visitor) {
  try {
    await transporter.sendMail({
      from: `"Visitor Management System" <${process.env.EMAIL_USER}>`,
      to: [visitor.email],
      subject: `✅ Visitor Pass Approved - ${visitor.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10b981; }
            .info-row { display: flex; margin: 10px 0; }
            .info-label { font-weight: bold; width: 150px; color: #6b7280; }
            .info-value { color: #111827; }
            .important-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Your Visitor Pass is Approved!</h1>
              <p>You can now visit us on your scheduled date</p>
            </div>
            
            <div class="content">
              <div class="info-box">
                <h2 style="margin-top: 0; color: #10b981;">Visitor Pass Details</h2>
                <div class="info-row">
                  <div class="info-label">Visitor ID:</div>
                  <div class="info-value"><strong>${
                    visitor.visitorId
                  }</strong></div>
                </div>
                <div class="info-row">
                  <div class="info-label">Name:</div>
                  <div class="info-value">${visitor.name}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Host:</div>
                  <div class="info-value">${visitor.host}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Entry Gate:</div>
                  <div class="info-value">${visitor.gate}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Visit Date/Time:</div>
                  <div class="info-value">${new Date(
                    visitor.allowedUntil
                  ).toLocaleString()}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Duration:</div>
                  <div class="info-value">${
                    visitor.expectedDuration
                  } minutes</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Status:</div>
                  <div class="info-value" style="color: #10b981; font-weight: bold;">APPROVED</div>
                </div>
              </div>

              <div class="important-box">
                <h3 style="margin-top: 0; color: #f59e0b;">📋 Important Instructions</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  <li>Please arrive 10 minutes before your scheduled time</li>
                  <li>Bring a valid government-issued ID (mandatory)</li>
                  <li>Show this email or your Visitor ID (${
                    visitor.visitorId
                  }) at the security gate</li>
                  <li>Entry is only valid at ${visitor.gate}</li>
                  <li>Your pass is valid for ${
                    visitor.expectedDuration
                  } minutes from check-in</li>
                  ${
                    visitor.vehicleNumber
                      ? `<li>Your vehicle (${visitor.vehicleNumber}) is registered</li>`
                      : ""
                  }
                </ul>
              </div>

              <p style="text-align: center; margin-top: 30px;">
                <strong>Need help?</strong><br>
                Contact us at <a href="mailto:visitors@company.com">visitors@company.com</a><br>
                or call +91-1800-XXX-XXXX
              </p>
            </div>
            
            <div class="footer">
              <p>This is an automated email from the Visitor Management System.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("✅ Visitor approved email sent to:", visitor.email);
  } catch (err) {
    console.error("❌ Failed to send visitor approved email:", err.message);
  }
}

/* =========================================================
   SEND VISITOR REJECTED EMAIL
========================================================= */
async function sendVisitorRejectedEmail(visitor) {
  try {
    await transporter.sendMail({
      from: `"Visitor Management System" <${process.env.EMAIL_USER}>`,
      to: visitor.email,
      subject: `❌ Visitor Request Not Approved - ${visitor.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ef4444; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>❌ Visitor Request Not Approved</h1>
            </div>
            
            <div class="content">
              <p>Dear ${visitor.name},</p>
              
              <p>We regret to inform you that your visitor request for <strong>${new Date(
                visitor.allowedUntil
              ).toLocaleString()}</strong> could not be approved at this time.</p>

              <div class="info-box">
                <h3 style="margin-top: 0; color: #ef4444;">Request Details</h3>
                <p><strong>Visitor ID:</strong> ${visitor.visitorId}</p>
                <p><strong>Reason:</strong> ${
                  visitor.rejectionReason || "Not specified"
                }</p>
              </div>

              <p>If you believe this is an error or would like to reschedule, please contact your host (<strong>${
                visitor.host
              }</strong>) directly or reach out to our support team.</p>

              <p style="text-align: center; margin-top: 30px;">
                <strong>Need assistance?</strong><br>
                Contact us at <a href="mailto:visitors@company.com">visitors@company.com</a><br>
                or call +91-1800-XXX-XXXX
              </p>
            </div>
            
            <div class="footer">
              <p>This is an automated email from the Visitor Management System.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("✅ Visitor rejected email sent to:", visitor.email);
  } catch (err) {
    console.error("❌ Failed to send visitor rejected email:", err.message);
  }
}

/* =========================================================
   GET ALL VISITORS
========================================================= */
router.get(
  "/",
  requireAuth,
  requireRole("reception", "security", "admin"),
  async (req, res) => {
    try {
      let query = {};

      // Security users only see their gate
      if (req.user.role === "security" && req.user.gateId) {
        query.gate = String(req.user.gateId);
      }

      const visitors = await Visitor.find(query).sort({ createdAt: -1 });
      res.json(visitors);
    } catch (err) {
      console.error("Get visitors error:", err);
      res.status(500).json({ message: "Failed to fetch visitors" });
    }
  }
);

/* =========================================================
   CHECK-IN
========================================================= */
router.post(
  "/check-in/:id",
  requireAuth,
  requireRole("security"),
  async (req, res) => {
    try {
      const visitor = await Visitor.findById(req.params.id);

      if (!visitor) {
        return res.status(404).json({ message: "Visitor not found" });
      }

      if (String(visitor.gate) !== String(req.user.gateId)) {
        return res.status(403).json({ message: "Wrong gate" });
      }

      if (visitor.status !== "APPROVED") {
        return res.status(400).json({ message: "Visitor not approved" });
      }

      visitor.status = "IN";
      visitor.checkInTime = new Date();
      visitor.checkedInBy = req.user.id;
      visitor.history.push({
        action: "CHECKED_IN",
        by: req.user.id,
        note: "Checked in by security",
      });

      await visitor.save();

      await sendVisitorCheckedInEmailtoHost(visitor);

      // Emit socket update
      if (req.io) {
        req.io.emit(
          "visitors:update",
          await Visitor.find().sort({ createdAt: -1 })
        );
      }

      res.json({ success: true, visitor });
    } catch (err) {
      console.error("Check-in error:", err);
      res.status(500).json({ message: "Check-in failed" });
    }
  }
);

async function sendVisitorCheckedInEmailtoHost(visitor) {
  try {
    const checkOutUrl = `${process.env.BASE_URL}/api/visitor/check-out/${visitor._id}`;

    await transporter.sendMail({
      from: `"Visitor Management System" <${process.env.EMAIL_USER}>`,
      to: visitor.hostEmail,
      subject: `🔔 Visitor Checked In - ${visitor.name}`,
      html: `
        <div style="font-family: 'Inter', 'Segoe UI', Roboto, Arial, sans-serif; background: #eef2f7; padding: 40px;">
          <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
            
            <!-- Top Accent Bar -->
            <div style="height: 6px; background: linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6);"></div>

            <!-- Header -->
            <div style="text-align: center; padding: 28px 20px 12px;">
              <img src="https://cdn-icons-png.flaticon.com/512/906/906343.png" alt="Visitor Icon" width="60" style="margin-bottom: 8px;" />
              <h2 style="color: #111827; font-size: 22px; margin: 0;">Visitor Check-In Alert</h2>
              <p style="color: #6b7280; font-size: 14px; margin-top: 6px;">Your guest has arrived at the gate</p>
            </div>

            <!-- Body -->
            <div style="padding: 0 32px 32px; color: #1f2937;">
              <div style="background: #f9fafb; border-radius: 10px; padding: 18px 20px; border: 1px solid #e5e7eb; margin-top: 20px;">
                <p style="margin: 0; font-size: 15px;">Dear <strong>${visitor.host}</strong>,</p>
                <p style="margin: 12px 0 18px; font-size: 15px; line-height: 1.6;">
                  Your visitor <strong style="color: #111827;">${visitor.name}</strong> has successfully checked in at the security gate.
                </p>

                <h3 style="font-size: 15px; color: #374151; margin: 0 0 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">
                  Visitor Details
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Visitor ID:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600;">${visitor.visitorId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Name:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600;">${visitor.name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Check-In Time:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600;">${new Date(visitor.checkInTime).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Gate:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600;">${visitor.gate}</td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin-top: 36px;">
                <a href="${checkOutUrl}"
                  style="display: inline-block; background: linear-gradient(90deg, #3b82f6, #6366f1); color: #ffffff;
                          padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; letter-spacing: 0.3px;
                          box-shadow: 0 3px 10px rgba(99,102,241,0.3);">
                  🔓 Check Out Visitor
                </a>
              </div>

              <!-- Signature -->
              <div style="margin-top: 40px; text-align: center; font-size: 13px; color: #6b7280;">
                <p style="margin: 0;">Kind regards,</p>
                <p style="font-weight: 600; color: #111827; margin: 4px 0;">Visitor Management System</p>
              </div>
            </div>

            <!-- Footer -->
            <div style="background: #f3f4f6; text-align: center; font-size: 12px; color: #9ca3af; padding: 12px 0;">
              <p style="margin: 0;">This is an automated message. Please do not reply.</p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("✅ Visitor checked-in email sent to host:", visitor.hostEmail);
  } catch (err) {
    console.error("❌ Failed to send checked-in email to host:", err.message);
  }
}

/* =========================================================
   CHECK-OUT
========================================================= */

// check-out route from security dashboard
router.post(
  "/check-out/:id",
  requireAuth,
  requireRole("security"),
  async (req, res) => {
    try {
      const visitor = await Visitor.findById(req.params.id);

      if (!visitor) {
        return res.status(404).json({ message: "Visitor not found" });
      }

      if (!["IN", "OVERSTAY"].includes(visitor.status)) {
        return res.status(400).json({ message: "Visitor not checked in" });
      }

      visitor.status = "OUT";
      visitor.checkOutTime = new Date();
      visitor.checkedOutBy = req.user.id;

      if (visitor.checkInTime) {
        visitor.actualDuration = Math.floor(
          (new Date() - new Date(visitor.checkInTime)) / 60000
        );
      }

      visitor.history.push({
        action: "CHECKED_OUT",
        by: req.user.id,
        note: "Checked out by security",
      });

      await visitor.save();

      // Emit socket update
      if (req.io) {
        req.io.emit(
          "visitors:update",
          await Visitor.find().sort({ createdAt: -1 })
        );
      }

      res.json({ success: true, visitor });
    } catch (err) {
      console.error("Check-out error:", err);
      res.status(500).json({ message: "Check-out failed" });
    }
  }
);

// check-out route from host email
router.get("/check-out/:id", async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).send("Visitor not found");
    }
    if (!["IN", "OVERSTAY"].includes(visitor.status)) {
      return res.status(400).send("Visitor not checked in");
    }

    visitor.status = "OUT";
    visitor.checkOutTime = new Date();
    if (visitor.checkInTime) {
      visitor.actualDuration = Math.floor(
        (new Date() - new Date(visitor.checkInTime)) / 60000
      );
    }
    visitor.history.push({
      action: "CHECKED_OUT",
      note: "Checked out via host email link",
    });
    await visitor.save();

    res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">

          <h2 style="color: #10b981;">✅ Visitor Checked Out Successfully!</h2>
          <p>Visitor <strong>${visitor.name}</strong> (ID: ${visitor.visitorId}) has been checked out.</p>
          <p style="color: #6b7280; margin-top: 30px;">You can close this window.</p>
          
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Check-out via email error:", err);
    res.status(500).send("Check-out failed");
  }
});

/* =========================================================
   BADGE DOWNLOAD
========================================================= */
router.get("/badge/:id", requireAuth, async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }

    await generateBadge(visitor, res);
  } catch (err) {
    console.error("Badge download error:", err);
    res.status(500).json({ message: "Failed to generate badge" });
  }
});

router.get(
  "/visitorList",
  requireAuth,
  requireRole("admin", "superadmin", "security"),
  async (req, res) => {
    try {
      const visitors = await Visitor.find().sort({ createdAt: -1 });
      res.json(visitors);
    } catch (err) {
      console.error("Fetch visitors error:", err);
      res.status(500).json({ error: "Failed to fetch visitors" });
    }
  }
);

export default router;
