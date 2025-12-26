// server/utils/mailer.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendEmail = async (to, subject, html) => {
    await transporter.sendMail({
        from: `"VPass" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    });
};


// =========== //
/*const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});*/

/*export async function sendHostEmail(toEmail, subject, html) {
  if (!process.env.SMTP_HOST) {
    console.warn("SMTP not configured — skipping host email");
    return;
  }

  const info = await transporter.sendMail({
    from: `"VPass" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject,
    html,
  });

  console.log("Host email sent:", info.messageId);
  return info;
}*/
// =========== //

