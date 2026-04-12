// PantryOS — Decision engine
// Uses Supabase REST API directly (no npm imports needed) + GPT-4o

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cwqzcfrgbvxerhgwsnhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cXpjZnJnYnZ4ZXJoZ3dzbmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTcwNjksImV4cCI6MjA5MTMzMzA2OX0.CH653qa1WD6GVgxzsuq9f4sHzEWKmagyygXaDG0lt6g';
const NJ_STORES = ['ShopRite', 'Stop & Shop', 'Wegmans', 'Acme Markets'];
const NJ_STORES_FILTER = NJ_STORES.map(s => encodeURIComponent(s)).join(',');

async function getNJPrices(items) {
  try {
    // ONE query for all stores — no N+1 serial fetching
    const url = `${SUPABASE_URL}/rest/v1/price_cache?store=in.(${NJ_STORES_FILTER})&select=store,item_name,price,unit,brand,updated_at&order=updated_at.desc&limit=2000`;
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return { allPrices: {}, cacheAgeHours: null };
    const allRows = await res.json();

    // Build lookup map in memory — O(n) not O(n*m)
    const cacheMap = {};
    for (const row of allRows) {
      const key = row.item_name.toLowerCase();
      if (!cacheMap[key]) cacheMap[key] = {};
      if (!cacheMap[key][row.store]) {
        cacheMap[key][row.store] = {
          price: parseFloat(row.price),
          unit: row.unit,
          brand: row.brand,
          updated_at: row.updated_at,
        };
      }
    }

    // Match each requested item using exact then keyword fallback
    const allPrices = {};
    for (const item of items) {
      const itemKey = item.name.toLowerCase().trim();
      const keyword = itemKey.split(' ')[0];
      let matched = cacheMap[itemKey];
      if (!matched) {
        const matchKey = Object.keys(cacheMap).find(k =>
          k.includes(keyword) || keyword.includes(k.split(' ')[0])
        );
        if (matchKey) matched = cacheMap[matchKey];
      }
      if (matched) allPrices[item.name] = matched;
    }

    const lastUpdated = allRows[0]?.updated_at;
    const cacheAgeHours = lastUpdated
      ? Math.round((Date.now() - new Date(lastUpdated).getTime()) / 3600000)
      : null;

    return { allPrices, cacheAgeHours };
  } catch (e) {
    console.warn('Price cache lookup failed:', e.message);
    return { allPrices: {}, cacheAgeHours: null };
  }
}

export default async function handler(req, res) {
  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, env: { hasOpenAI: !!process.env.OPENAI_API_KEY, hasSupabase: !!process.env.SUPABASE_URL } });
  }
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

  // --- Step 1: Get NJ prices from Supabase cache ---
  const { allPrices, cacheAgeHours } = await getNJPrices(items);
  const hasLivePrices = Object.keys(allPrices).length > 0;

  // --- Step 2: Per-store basket totals ---
  const storeBaskets = {};
  if (hasLivePrices) {
    for (const store of NJ_STORES) {
      let total = 0;
      let matchCount = 0;
      for (const item of items) {
        const cached = allPrices[item.name]?.[store];
        if (cached) {
          total += cached.price * (item.quantity || 1);
          matchCount++;
        }
      }
      if (matchCount > 0) {
        storeBaskets[store] = {
          total: total.toFixed(2),
          coverage: Math.round((matchCount / items.length) * 100),
        };
      }
    }
  }

  // --- Step 3: Build prompt ---
  const itemList = items.map(i => {
    const storePrices = Object.entries(allPrices[i.name] || {})
      .map(([store, d]) => `${store}: $${(d.price * (i.quantity || 1)).toFixed(2)}`)
      .join(', ');
    return `- ${i.name} (qty: ${i.quantity || 1}${i.category ? ', ' + i.category : ''}${storePrices ? ' | ' + storePrices : ''})`;
  }).join('\n');

  const storeSummary = Object.entries(storeBaskets)
    .sort((a, b) => parseFloat(a[1].total) - parseFloat(b[1].total))
    .map(([store, b]) => `${store}: $${b.total} (${b.coverage}% matched)`)
    .join(', ');

  const priceNote = hasLivePrices
    ? `\nREAL NJ STORE PRICES (cache ${cacheAgeHours != null ? cacheAgeHours + 'h old' : 'recent'}): ${storeSummary}. Use these exact totals.`
    : '\nNo cached prices available — estimate realistic NJ grocery prices.';

  const prompt = `
Household: ${household.name}, ${household.people} people (${household.kids || 0} kids under 12)
Dietary: ${(household.dietary || ['None']).join(', ')}
Budget: ${household.budget || 'Not specified'}
Mode: ${household.default_mode || 'balanced'}
Location: New Jersey
${priceNote}

Items:
${itemList}

Return 3 basket options:
1. "cheapest" — ShopRite (cheapest NJ chain). Use real total if available.
2. "balanced" — Wegmans or Stop & Shop. Use real total if available.
3. "easiest" — Instacart delivery from nearest NJ store.

JSON format: {cheapest:{total,store,highlights[3],items[{name,price}]}, balanced:{...}, easiest:{...}, confidence:int, reasoning:string}
`.trim();

  // --- Step 4: GPT-4o ---
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
            content: 'You are PantryOS, a household buying AI for New Jersey shoppers. NJ stores: ShopRite (cheapest), Acme Markets, Stop & Shop, Wegmans (premium). When given real cached prices, use them precisely. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    const data = await openaiRes.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error(`No content from OpenAI. Response: ${JSON.stringify(data).substring(0,300)}`);

    const result = JSON.parse(content);
    result.livePrices = hasLivePrices;
    result.cacheAgeHours = cacheAgeHours;
    return res.status(200).json(result);
  } catch (err) {
    console.error('Decision engine error:', err.message);
    return res.status(500).json({ error: 'Engine error', detail: err.message, mock: true });
  }
}
