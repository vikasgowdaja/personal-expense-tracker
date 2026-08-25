const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS   // app password, not account password
  }
});

/**
 * Send a 6-digit OTP to the given email address.
 * @param {string} to  - recipient email
 * @param {string} otp - 6-digit OTP string
 */
async function sendOTPEmail(to, otp) {
  const mailOptions = {
    from: `"Personal Ops Intelligence" <${process.env.MAIL_USER}>`,
    to,
    subject: 'Your OTP Code',
    text: `Your one-time password is: ${otp}\n\nIt expires in 10 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px">
        <h2 style="margin-top:0">Verification Code</h2>
        <p>Use the following OTP to complete your action:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f4f4f4;border-radius:6px">
          ${otp}
        </div>
        <p style="color:#888;font-size:13px;margin-top:16px">Expires in <b>10 minutes</b>. Never share this code.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

async function sendPasswordResetEmail(to, resetUrl) {
  const mailOptions = {
    from: `"Personal Ops Intelligence" <${process.env.MAIL_USER}>`,
    to,
    subject: 'Reset your Personal Ops password',
    text: `Use this link to reset your password: ${resetUrl}\n\nThis link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px"><h2 style="margin-top:0">Reset your password</h2><p>Use the button below to choose a new password.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#423fdb;color:#fff;text-decoration:none;border-radius:6px">Reset password</a></p><p style="color:#888;font-size:13px;margin-top:16px">This link expires in <b>30 minutes</b> and can only be used once. If you did not request this, you can ignore this email.</p></div>`
  };
  await transporter.sendMail(mailOptions);
}

module.exports = { sendOTPEmail, sendPasswordResetEmail };
