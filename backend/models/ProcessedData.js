const mongoose = require('mongoose');

const ProcessedDataSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  fileName: { type: String },
  imagePath: { type: String },
  originalItems: { type: Array, default: [] },
  processedItems: { type: Array, default: [] },
  openaiResponse: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ProcessedData', ProcessedDataSchema);
