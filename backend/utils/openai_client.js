const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs').promises;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Process receipt image using OpenAI Vision API
 * Returns structured expense/line-item data extracted from the image
 */
async function processReceiptWithVision(imagePath) {
  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set - skipping OpenAI vision processing');
    return { success: false, reason: 'no_api_key' };
  }

  try {
    // Read image and convert to base64
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const imageMediaType = 'image/jpeg'; // Adjust based on file extension if needed

    const systemPrompt = `You are an expert receipt analyzer. Extract all expense data from the receipt image.
Return a JSON object with this exact structure:
{
  "merchant": "store/restaurant name",
  "items": [
    {
      "item_name": "product name",
      "quantity": 1,
      "unit_price": 0.00,
      "total_price": 0.00,
      "tax": 0.00,
      "discount": 0.00,
      "category_suggestion": "Food|Shopping|Transport|Entertainment|Bills|Healthcare|Other"
    }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "date": "YYYY-MM-DD",
  "confidence": 0.95,
  "notes": "any additional observations"
}
Respond with only valid JSON.`;

    const userPrompt = `Please analyze this receipt image and extract all line items and pricing information.`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageMediaType};base64,${base64Image}`
                }
              },
              { type: 'text', text: userPrompt }
            ]
          }
        ],
        temperature: 0.0,
        max_tokens: 2000
      })
    });

    const data = await resp.json();
    if (!data || !data.choices || !data.choices[0]) {
      return { success: false, reason: 'no_choice', raw: data };
    }

    const rawText = data.choices[0].message?.content || '';

    // Parse JSON response
    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      // Try to extract first JSON substring
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (err) {
          parsed = null;
        }
      }
    }

    return { success: true, raw: data, text: rawText, parsed };
  } catch (err) {
    console.error('Vision API request failed', err.message);
    return { success: false, reason: 'request_failed', error: err.message };
  }
}

module.exports = { processReceiptWithVision };
