const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  color: {
    type: String,
    default: '#000000'
  },
  icon: {
    type: String,
    default: '📁'
  }
});

module.exports = mongoose.model('Category', categorySchema);
