const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

const app = express();

// Trust the first proxy hop (required for express-rate-limit behind Render/Railway/Nginx)
app.set('trust proxy', 1);


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again later.' }
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests, please wait before trying again.' }
});

// ─── Global Middleware ────────────────────────────────────────────────────────

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser tools and same-origin requests without Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '2mb' }));

// ─── Database ─────────────────────────────────────────────────────────────────

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-tracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// ─── Routes ───────────────────────────────────────────────────────────────────

// Auth routes – heavy rate limiting on OTP/login
app.use('/api/auth/request-otp', otpLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', require('./routes/auth'));

// Business routes
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/ocr', require('./routes/ocr'));
app.use('/api/trainers', require('./routes/trainers'));
app.use('/api/institutions', require('./routes/institutions'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/training-engagements', require('./routes/trainingEngagements'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payment-details', require('./routes/paymentDetails'));
app.use('/api/user-data', require('./routes/userData'));
app.use('/api/trainer-settlements', require('./routes/trainerSettlements'));
app.use('/api/system', require('./routes/system'));

// Privileged routes (superadmin only – enforced inside each router)
app.use('/api/financial', require('./routes/financial'));
app.use('/api/employees', require('./routes/employees'));

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({ message: 'Personal Ops Intelligence API' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

