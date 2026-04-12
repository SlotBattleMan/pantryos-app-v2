// PantryOS — Receipt scanning via GPT-4o Vision
// Accepts a base64 image, returns structured items with prices and store name

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cwqzcfrgbvxerhgwsnhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cXpjZnJnYnZ4ZXJoZ3dzbmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTcwNjksImV4cCI6MjA5MTMzMzA2OX0.CH653qa1WD6GVgxzsuq9f4sHzEWKmagyygXaDG0lt6g';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI not configured' });
  }

  const { image, mediaType = 'image/jpeg' } = req.body || {};
  if (!image) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this grocery receipt image and extract all purchased items.

Return a JSON object with this exact structure:
{
  "store": "store name (e.g. ShopRite, Wegmans, Stop & Shop, Acme Markets, Walmart, Target, etc.)",
  "date": "purchase date in YYYY-MM-DD format if visible, otherwise null",
  "total": "total amount as string (e.g. '47.23') or null",
  "items": [
    {
      "name": "clean item name (e.g. 'Milk', 'Chicken Breast', 'Bananas')",
      "brand": "brand if visible (e.g. 'Perdue', 'Tropicana') or null",
      "quantity": number (default 1),
      "price": "unit price as string (e.g. '3.49') or null",
      "category": "one of: Produce, Dairy & Eggs, Meat & Seafood, Bakery & Bread, Pantry Staples, Snacks, Frozen, Beverages, Household, Personal Care, Baby & Kids"
    }
  ]
}

Rules:
- ONLY include actual purchasable grocery/household products
- SKIP everything that is not a real product: weight adjustments, loyalty savings, subtotals, tax lines, bag fees, payment lines, category headers, "Items found" lines, "Special Request" lines, deposit fees, bottle returns, quantity multiplier lines (e.g. "2 x"), price adjustment lines (e.g. "Adjustment: 3.0 lb -> 2.01 lb"), any line that is purely numeric, any line starting with a number followed by 'x' or 'lb'
- Normalize item names to clean short names (e.g. "Wegmans Vitamin D Whole Milk (1 gal)" → "Whole Milk")
- If an item was bought multiple times (e.g. 3x), set quantity accordingly  
- Price should be the final unit price actually paid, not a subtotal or intermediate calculation
- Maximum realistic price for any single grocery item is $50. If a price exceeds this, it is likely a subtotal — skip it
- Return only valid JSON, no markdown`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response from Vision API');

    // Parse the JSON response
    const result = JSON.parse(content);

    // Validate structure
    if (!result.items || !Array.isArray(result.items)) {
      throw new Error('Invalid response structure');
    }

    // Server-side filter: remove any non-product lines that slipped through
    const skipPatterns = [
      /^\d+(\.\d+)?\s*(x|lb|oz|ct|ea)/i,  // "2 x", "1.39 lb"
      /adjustment/i,
      /subtotal/i,
      /loyalty/i,
      /savings/i,
      /weight/i,
      /items found/i,
      /special request/i,
      /deposit/i,
      /bottle return/i,
      /^(produce|dairy|meat|bakery|frozen|snacks|beverages|pantry|canned|dry goods|international|breakfast)$/i,
    ];

    result.items = result.items.filter(item => {
      if (!item.name || item.name.trim().length < 2) return false;
      if (skipPatterns.some(p => p.test(item.name.trim()))) return false;
      if (item.price && parseFloat(item.price) > 50) return false; // skip subtotals
      if (item.price && parseFloat(item.price) <= 0) return false;
      return true;
    });

    // Feed verified prices into the price cache for this store
    if (result.store && result.items.length > 0) {
      const NJ_STORES = ['ShopRite', 'Stop & Shop', 'Wegmans', 'Acme Markets'];
      const isNJStore = NJ_STORES.some(s =>
        result.store.toLowerCase().includes(s.toLowerCase()) ||
        s.toLowerCase().includes(result.store.toLowerCase())
      );

      if (isNJStore) {
        // Upsert prices — receipt is ground truth
        const upserts = result.items
          .filter(item => item.name && item.price && parseFloat(item.price) > 0)
          .map(item => ({
            store: result.store,
            item_name: item.name.toLowerCase(),
            price: parseFloat(item.price),
            unit: null,
            brand: item.brand || null,
            updated_at: new Date().toISOString(),
          }));

        if (upserts.length > 0) {
          await fetch(`${SUPABASE_URL}/rest/v1/price_cache`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates',
            },
            body: JSON.stringify(upserts),
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      store: result.store || null,
      date: result.date || null,
      total: result.total || null,
      itemCount: result.items.length,
      items: result.items,
    });

  } catch (err) {
    console.error('Receipt scan error:', err.message);
    return res.status(500).json({
      error: 'Could not read receipt',
      detail: err.message
    });
  }
}
