// PantryOS — Vercel serverless function for decision engine
// Fetches real Kroger prices first, then feeds them to GPT-4o

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI engine not configured', mock: true });
  }

  const { items, household } = req.body || {};
  if (!items || !household) {
    return res.status(400).json({ error: 'Missing items or household' });
  }

  // --- Step 1: Try to fetch real Kroger prices ---
  let krogerPrices = {};
  let krogerLocationId = null;
  let hasLivePrices = false;

  const zipCode = household.zip_code;
  if (zipCode && process.env.KROGER_CLIENT_ID && process.env.KROGER_CLIENT_SECRET) {
    try {
      const krogerRes = await fetch(`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/kroger-prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, zipCode }),
      });
      if (krogerRes.ok) {
        const krogerData = await krogerRes.json();
        if (krogerData.prices && Object.keys(krogerData.prices).length > 0) {
          krogerPrices = krogerData.prices;
          krogerLocationId = krogerData.locationId;
          hasLivePrices = true;
        }
      }
    } catch (e) {
      console.warn('Kroger price fetch failed, continuing without live prices:', e.message);
    }
  }

  // --- Step 2: Build prompt with real prices if available ---
  const itemList = items.map(i => {
    const kroger = krogerPrices[i.name];
    const priceNote = kroger
      ? ` [Kroger price: $${kroger.price}${kroger.promo ? ' (on sale, regular $' + kroger.regular + ')' : ''}${kroger.size ? ', ' + kroger.size : ''}]`
      : '';
    return `- ${i.name} (qty: ${i.quantity || 1}${i.category ? ', ' + i.category : ''}${priceNote})`;
  }).join('\n');

  const livePriceNote = hasLivePrices
    ? `\nREAL KROGER PRICES: You have live pricing data from a nearby Kroger store for ${Object.keys(krogerPrices).length}/${items.length} items. Use these exact prices for the "cheapest" basket total. For items without Kroger prices, estimate realistically.`
    : '\nNo live pricing data available — estimate realistic current prices.';

  const prompt = `
Household: ${household.name}
People: ${household.people} (${household.kids || 0} kids under 12)
Dietary needs: ${(household.dietary || ['None']).join(', ')}
Weekly budget: ${household.budget || 'Not specified'}
Default mode: ${household.default_mode || 'balanced'}
ZIP code: ${zipCode || 'Not provided'}
${livePriceNote}

Items needed:
${itemList}

Return three basket options:
1. "cheapest" — Kroger/Walmart, use real Kroger prices where provided
2. "balanced" — Best quality-value, e.g. Whole Foods or Target
3. "easiest" — Instacart or Amazon Fresh, same-day delivery

Each option: total (dollar string), store (name), highlights (3 strings), items (array of {name, price as string}).
Top-level: confidence (0-100), reasoning (1 sentence), livePrices (boolean: ${hasLivePrices}).
Return only valid JSON, no markdown.
  `.trim();

  // --- Step 3: Call GPT-4o ---
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are PantryOS, a household buying intelligence engine. Given grocery items with optional real store prices, return a JSON object with three basket options: cheapest, balanced, and easiest. Each option has: total (dollar amount as string), store (store name), highlights (array of 3 short benefit strings), items (array of objects with name and price as strings), and confidence (0-100 integer). Also include top-level: reasoning (1 sentence string), livePrices (boolean). Return only valid JSON, no markdown.`,
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    const data = await openaiRes.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content from OpenAI');

    const result = JSON.parse(content);
    // Ensure livePrices flag is set correctly
    result.livePrices = hasLivePrices;
    result.krogerLocationId = krogerLocationId;

    return res.status(200).json(result);
  } catch (err) {
    console.error('Decision engine error:', err.message);
    return res.status(500).json({ error: 'Engine error', mock: true });
  }
}
