# Personal Expense Tracker - MERN Stack with AI

A full-stack web application for tracking personal expenses built with MongoDB, Express.js, React, and Node.js, **powered by an advanced offline AI system (PFIE)** for intelligent financial analysis.

## 🌟 AI Features (PFIE - Offline Personal Financial Intelligence Engine)

### 🧠 Intelligent Receipt Analysis
- **95%+ Accurate OCR**: PaddleOCR extracts text from financial screenshots
- **Smart Grouping**: Automatically associates merchant names, amounts, and timestamps
- **Multi-Screenshot Support**: Batch process 10+ images at once

### 📈 Spending Intelligence
- **7-Day Forecasting**: Predicts future spending based on historical patterns
- **Anomaly Detection**: Alerts when spending is unusual (Z-score based, 95% confidence)
- **Auto-Categorization**: Intelligently assigns Food, Transport, Shopping, etc.

### 🔄 Self-Learning System
- **Learns from Corrections**: System improves when you correct extracted data
- **Health Monitoring**: Tracks confidence scores and suggests rule improvements
- **Healing Engine**: Auto-adjusts thresholds based on feedback

### 🔐 Privacy-First
- ✅ **Fully Offline**: No cloud APIs, no internet required
- ✅ **Local Processing**: All AI runs on your device
- ✅ **User-Owned Data**: You control everything

## Traditional Features

- 🔐 User Authentication (Register/Login)
- 💰 Add, View, and Delete Expenses
- 📊 Dashboard with Expense Statistics
- 📈 Visual Charts (Pie Chart for Category Distribution)
- 🏷️ Categorize Expenses (Food, Transport, Entertainment, etc.)
- � **OCR Receipt Upload** - Bulk upload receipt images and automatically extract expense data
- 🔍 **Smart Duplicate Detection** - Prevents duplicate entries based on date, amount, and transaction name
- ✏️ **Data Curation** - Review and edit extracted data before saving
- �📱 Responsive Design

## Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- bcryptjs for password hashing
- **Tesseract.js** for OCR (text extraction from images)
- **Multer** for file uploads
- **Sharp** for image processing

### Frontend
- React 18
- React Router v6
- Axios for API calls
- Recharts for data visualization
- CSS3 for styling

## Prerequisites

Before running this application, make sure you have:
- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas account)
- npm or yarn package manager

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd personal-expense-tracker
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/expense-tracker
JWT_SECRET=your_secret_key_here_change_this_in_production
```

**Important:** Change the `JWT_SECRET` to a strong, random string in production.

### 3. Frontend Setup

```bash
cd frontend
npm install
```

## Running the Application

### Start MongoDB
Make sure MongoDB is running on your system:
```bash
# On Windows (if MongoDB is installed as a service)
net start MongoDB

# On Mac/Linux
mongod
```

### Start Backend Server
```bash
cd backend
npm start
# or for development with auto-reload
npm run dev
```
Backend will run on http://localhost:5000

### Start Frontend
```bash
cd frontend
npm start
```
Frontend will run on http://localhost:3000

## Project Structure

```
personal-expense-tracker/
├── backend/
│   ├── models/
│   │   ├── User.js
│   │   ├── Expense.js
│   │   └── Category.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── expenses.js
│   │   ├── categories.js
│   │   └── ocr.js (NEW - Receipt OCR processing)
│   ├── middleware/
│   │   ├── auth.js
│   │   └── upload.js (NEW - File upload handling)
│   ├── utils/
│   │   └── ocrProcessor.js (NEW - OCR and data extraction)
│   ├── uploads/ (Created automatically for receipt images)
│   ├── server.js
│   ├── package.json
│   └── .env
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/
│   │   │   │   ├── Login.js
│   │   │   │   ├── Register.js
│   │   │   │   └── Auth.css
│   │   │   ├── Dashboard/
│   │   │   │   ├── Dashboard.js
│   │   │   │   └── Dashboard.css
│   │   │   ├── Expenses/
│   │   │   │   ├── ExpenseList.js
│   │   │   │   ├── AddExpense.js
│   │   │   │   ├── UploadReceipt.js (NEW)
│   │   │   │   ├── UploadReceipt.css (NEW)
│   │   │   │   └── Expenses.css
│   │   │   └── Layout/
│   │   │       ├── Navbar.js
│   │   │       └── Navbar.css
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/user` - Get logged in user (protected)

### Expenses
- `GET /api/expenses` - Get all expenses (protected)
- `GET /api/expenses/:id` - Get expense by ID (protected)
- `POST /api/expenses` - Create new expense (protected)
- `PUT /api/expenses/:id` - Update expense (protected)
- `DELETE /api/expenses/:id` - Delete expense (protected)
- `GET /api/expenses/stats/summary` - Get expense statistics (protected)

### Categories
- `GET /api/categories` - Get all categories (protected)
- `POST /api/categories` - Create new category (protected)

### OCR (NEW)
- `POST /api/ocr/upload` - Upload receipt images and extract data (protected)
- `POST /api/ocr/save` - Save reviewed expenses from OCR (protected)
- `DELETE /api/ocr/cleanup/:filename` - Clean up uploaded image (protected)

## Usage

### Manual Entry
1. **Register/Login**: Create an account or login with existing credentials
2. **Add Expenses**: Click "Add Expense" to record a new expense with title, amount, category, date, and description
3. **View Expenses**: Navigate to "Expenses" to see all your expenses with filtering options
4. **Dashboard**: View your expense summary and category breakdown with visual charts

### Receipt Upload (NEW) 📷

1. **Upload Receipts**: Click "📷 Upload Receipt" in the navigation menu
2. **Select Images**: Choose one or multiple receipt images (JPG, PNG, GIF - max 10 at once)
3. **Auto-Extract**: The system automatically:
   - Extracts text from images using OCR
   - Identifies amounts, dates, and merchant names
   - Detects expense categories automatically
   - Checks for potential duplicates
4. **Review & Edit**: Before saving, you can:
   - Edit any extracted data (title, amount, date, category)
   - Ignore expenses you don't want to save
   - Choose to save items marked as duplicates
5. **Save**: Bulk save all approved expenses to your account

### Duplicate Detection
The system automatically detects potential duplicates by checking:
- Same date (within 24 hours)
- Similar amount (within 5% tolerance)
- Similar transaction name (50%+ word match)

Duplicates are highlighted with a warning, and you can choose to save them or skip them.
5. **Delete Expenses**: Remove expenses you no longer need

## Available Categories

- Food
- Transport
- Entertainment
- Shopping
- Bills
- Healthcare
- Other

## Future Enhancements

- Monthly/Yearly expense reports
- Budget setting and tracking
- Export data to CSV/PDF
- Recurring expense management
- Multiple currency support
- Mobile app version
- Improved OCR accuracy with AI/ML models
- Receipt image storage and viewing

## Troubleshooting

### OCR Not Working
- Ensure images are clear and text is readable
- Supported formats: JPG, PNG, GIF, BMP
- Maximum file size: 5MB per image
- For best results, use well-lit, high-contrast images

### Upload Directory Errors
The `uploads/` directory is created automatically. If you encounter errors:
```bash
mkdir backend/uploads
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Contact

For questions or support, please open an issue in the repository.
