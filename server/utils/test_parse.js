const { parseExpenseData } = require('./ocrProcessor');

const sample = `gold won: $0
A AXIS MY ZONE - #1,00,000.00: $5986
5 gold purchased: $500
5 gold purchased ¥: $500
gold won: $20
5 gold purchased: $500`;

const res = parseExpenseData(sample);
console.log(JSON.stringify(res, null, 2));
