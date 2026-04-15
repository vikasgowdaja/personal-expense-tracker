const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { sendOTPEmail } = require("../utils/mailer");

// ─── helpers ─────────────────────────────────────────────────────────────────

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

async function generateEmployeeId(name) {
  const prefix = name.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  const count = await User.countDocuments({ employeeId: { $regex: `^${prefix}` } });
  return `${prefix}${String(count + 1).padStart(3, '0')}`;
}

function issueTokens(user) {
  const payload = { user: { id: user.id, role: user.role } };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
  return { accessToken, refreshToken };
}

// ─── REGISTER (email + password) ─────────────────────────────────────────────

router.post("/register", [
  body("name", "Name is required").not().isEmpty(),
  body("email", "Please include a valid email").isEmail(),
  body("password", "Password must be at least 8 characters").isLength({ min: 8 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });

    const otp = generateOTP();
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    const hashedOTP = await bcrypt.hash(otp, 10);
    const employeeId = await generateEmployeeId(name);

    user = new User({
      name,
      email,
      password: hashedPassword,
      role: 'employee',
      employeeId,
      otp: hashedOTP,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
      isVerified: false
    });
    await user.save();

    await sendOTPEmail(email, otp);

    res.status(201).json({ message: "Registration successful. Check your email for the OTP to verify your account." });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// ─── VERIFY EMAIL OTP (after registration) ───────────────────────────────────

router.post("/verify-email", [
  body("email", "Valid email required").isEmail(),
  body("otp", "OTP required").not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });
    if (user.isVerified) return res.status(400).json({ message: "Already verified" });
    if (!user.otp || !user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ message: "OTP expired or invalid. Request a new one." });
    }

    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) return res.status(400).json({ message: "Invalid OTP" });

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    const { accessToken, refreshToken } = issueTokens(user);
    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    await user.save();

    res.json({
      token: accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, employeeId: user.employeeId }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// ─── LOGIN (email + password) ─────────────────────────────────────────────────

router.post("/login", [
  body("email", "Please include a valid email").isEmail(),
  body("password", "Password is required").exists()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.isVerified) {
      return res.status(403).json({ message: "Email not verified. Please verify your email first." });
    }

    const { accessToken, refreshToken } = issueTokens(user);
    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    await user.save();

    res.json({
      token: accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, employeeId: user.employeeId }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// ─── REQUEST OTP LOGIN ────────────────────────────────────────────────────────

router.post("/request-otp", [
  body("email", "Valid email required").isEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    // Return generic message to prevent user enumeration
    if (!user || !user.isVerified) {
      return res.json({ message: "If that account exists, an OTP has been sent." });
    }

    const otp = generateOTP();
    user.otp = await bcrypt.hash(otp, 10);
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOTPEmail(email, otp);
    res.json({ message: "If that account exists, an OTP has been sent." });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// ─── OTP LOGIN (passwordless) ─────────────────────────────────────────────────

router.post("/login-otp", [
  body("email", "Valid email required").isEmail(),
  body("otp", "OTP required").not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !user.isVerified) return res.status(400).json({ message: "Invalid OTP or account" });
    if (!user.otp || !user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ message: "OTP expired. Request a new one." });
    }

    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) return res.status(400).json({ message: "Invalid OTP" });

    user.otp = null;
    user.otpExpires = null;
    const { accessToken, refreshToken } = issueTokens(user);
    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    await user.save();

    res.json({
      token: accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, employeeId: user.employeeId }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────

router.post("/refresh", [
  body("refreshToken", "Refresh token required").not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { refreshToken } = req.body;
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user || !user.refreshToken) return res.status(401).json({ message: "Invalid refresh token" });

    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) return res.status(401).json({ message: "Invalid refresh token" });

    const { accessToken, refreshToken: newRefresh } = issueTokens(user);
    user.refreshToken = await bcrypt.hash(newRefresh, 10);
    await user.save();

    res.json({ token: accessToken, refreshToken: newRefresh });
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

router.post("/logout", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// ─── GET CURRENT USER ─────────────────────────────────────────────────────────

router.get("/user", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -otp -otpExpires -refreshToken");
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
