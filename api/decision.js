// PantryOS — Decision engine
// Pulls NJ store prices from cache, feeds into GPT-4o for basket recommendations

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

  // --- Step 1: Fetch cached NJ store prices ---
  let storeBaskets = {};
  let hasLivePrices = false;
  let cacheAgeHours = null;

  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const priceRes = await fetch(`${proto}://${host}/api/store-prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      if (priceData.hasData) {
        storeBaskets = priceData.storeBaskets;
        hasLivePrices = true;
        cacheAgeHours = priceData.cacheAgeHours;
      }
    }
  } catch (e) {
    console.warn('Store price lookup failed:', e.message);
  }

  // --- Step 2: Build enriched item list for prompt ---
  const itemList = items.map(i => {
    const storePrices = Object.entries(storeBaskets)
      .map(([store, basket]) => {
        const found = basket.items?.find(bi => bi.name === i.name);
        return found ? `${store}: $${found.price}` : null;
      })
      .filter(Boolean)
      .join(', ');

    return `- ${i.name} (qty: ${i.quantity || 1}${i.category ? ', ' + i.category : ''}${storePrices ? ' | prices: ' + storePrices : ''})`;
  }).join('\n');

  // Build store totals summary for prompt
  const storeSummary = Object.entries(storeBaskets).map(([store, b]) =>
    `${store}: $${b.total} (${b.coverage}% items matched)`
  ).join(', ');

  const priceNote = hasLivePrices
    ? `\nREAL NJ STORE PRICES (cached within ${cacheAgeHours || '?'} hours): ${storeSummary}. Use these exact totals. For unmatched items, estimate realistically.`
    : '\nNo cached store prices available — estimate realistic NJ grocery prices.';

  const prompt = `
Household: ${household.name}
People: ${household.people} (${household.kids || 0} kids under 12)
Dietary needs: ${(household.dietary || ['None']).join(', ')}
Weekly budget: ${household.budget || 'Not specified'}
Default mode: ${household.default_mode || 'balanced'}
Location: New Jersey
${priceNote}

Items needed:
${itemList}

Return exactly three basket options for NJ shoppers:
1. "cheapest" — lowest total cost (ShopRite or best-priced NJ store)
2. "balanced" — best quality-value (Wegmans or Stop & Shop)
3. "easiest" — most convenient (Instacart delivery from nearest store)

For each option: total (dollar string), store (NJ store name), highlights (3 short strings), items (array of {name, price as string}).
Top-level fields: confidence (0-100 int), reasoning (1 sentence), livePrices (boolean: ${hasLivePrices}).
Return only valid JSON, no markdown.
  `.trim();

  // --- Step 3: GPT-4o ---
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
            content: `You are PantryOS, a household buying intelligence engine for New Jersey shoppers. The four main NJ grocery chains are ShopRite, Stop & Shop, Wegmans, and Acme Markets. When given real cached prices, use them precisely. Return only valid JSON with three basket options: cheapest, balanced, easiest. Each has: total (string), store (string), highlights (array of 3 strings), items (array of {name, price}). Top-level: confidence (int), reasoning (string), livePrices (boolean).`,
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
    result.livePrices = hasLivePrices;
    result.cacheAgeHours = cacheAgeHours;
    return res.status(200).json(result);
  } catch (err) {
    console.error('Decision engine error:', err.message);
    return res.status(500).json({ error: 'Engine error', mock: true });
  }
}
