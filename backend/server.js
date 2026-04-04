const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-tracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
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

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Personal Expense Tracker API' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
