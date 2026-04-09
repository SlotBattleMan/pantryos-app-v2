// PantryOS — Decision engine
// Pulls NJ store prices directly from Supabase, feeds into GPT-4o

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cwqzcfrgbvxerhgwsnhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_ud37Fjjl3BfBEMpH8rTZdA_k9BTYhDD';
const NJ_STORES = ['ShopRite', 'Stop & Shop', 'Wegmans', 'Acme Markets'];

async function getNJPrices(items) {
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    const allPrices = {};

    for (const item of items) {
      const keyword = item.name.toLowerCase().trim().split(' ')[0];
      const { data } = await sb
        .from('price_cache')
        .select('store, item_name, price, unit, brand')
        .ilike('item_name', `%${keyword}%`)
        .in('store', NJ_STORES)
        .order('updated_at', { ascending: false });

      if (data?.length) {
        allPrices[item.name] = {};
        for (const row of data) {
          if (!allPrices[item.name][row.store]) {
            allPrices[item.name][row.store] = {
              price: parseFloat(row.price),
              unit: row.unit,
            };
          }
        }
      }
    }

    // Get cache age
    const { data: freshness } = await sb
      .from('price_cache')
      .select('updated_at')
      .in('store', NJ_STORES)
      .order('updated_at', { ascending: false })
      .limit(1);

    const lastUpdated = freshness?.[0]?.updated_at;
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

  // --- Step 2: Build per-store basket totals ---
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

  // --- Step 3: Build enriched prompt ---
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
    ? `\nREAL NJ STORE PRICES from cache (${cacheAgeHours != null ? cacheAgeHours + 'h ago' : 'recent'}): ${storeSummary}. Use these exact totals for the basket cards. For unmatched items, estimate realistic NJ prices.`
    : '\nNo cached prices — estimate realistic NJ grocery prices for ShopRite, Stop & Shop, Wegmans, Acme Markets.';

  const prompt = `
Household: ${household.name}
People: ${household.people} (${household.kids || 0} kids under 12)
Dietary needs: ${(household.dietary || ['None']).join(', ')}
Weekly budget: ${household.budget || 'Not specified'}
Default mode: ${household.default_mode || 'balanced'}
Location: New Jersey (ZIP: ${household.zip_code || 'not provided'})
${priceNote}

Items needed:
${itemList}

Return three basket options for NJ shoppers:
1. "cheapest" — ShopRite (cheapest NJ chain). Use exact cached total if available.
2. "balanced" — Wegmans or Stop & Shop (best quality-value). Use exact cached total if available.
3. "easiest" — Instacart delivery from nearest NJ store.

Each option: total (dollar string, no $ sign), store (NJ store name), highlights (3 short strings), items (array of {name, price as string}).
Top-level: confidence (0-100 int), reasoning (1 sentence).
Return only valid JSON, no markdown.
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
            content: 'You are PantryOS, a household buying intelligence engine for New Jersey shoppers. The four NJ grocery chains are ShopRite (cheapest), Acme Markets, Stop & Shop, and Wegmans (premium). When given real cached prices, use them precisely for totals. Return only valid JSON with three basket options: cheapest, balanced, easiest. Each has: total (string without $ sign), store (string), highlights (array of 3 strings), items (array of {name, price}). Top-level: confidence (int 0-100), reasoning (1 sentence string).',
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
