// PantryOS — Store price lookup (single-query, no N+1)
// Fetches ALL price_cache rows for all NJ stores in one request, matches in memory

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cwqzcfrgbvxerhgwsnhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cXpjZnJnYnZ4ZXJoZ3dzbmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTcwNjksImV4cCI6MjA5MTMzMzA2OX0.CH653qa1WD6GVgxzsuq9f4sHzEWKmagyygXaDG0lt6g';
const NJ_STORES = ['ShopRite', 'Stop & Shop', 'Wegmans', 'Acme Markets'];
const NJ_STORES_FILTER = NJ_STORES.map(s => encodeURIComponent(s)).join(',');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { items } = req.body || {};
  if (!items?.length) return res.status(400).json({ error: 'Missing items' });

  // ONE query — fetch all cached prices for all NJ stores at once
  // Then match in memory (fast)
  const url = `${SUPABASE_URL}/rest/v1/price_cache?store=in.(${NJ_STORES_FILTER})&select=store,item_name,price,unit,brand,updated_at&order=updated_at.desc&limit=2000`;

  let allRows = [];
  try {
    const fetchRes = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (fetchRes.ok) allRows = await fetchRes.json();
  } catch (e) {
    console.error('price_cache fetch error:', e.message);
  }

  // Build a lookup map: item_name → { store → { price, unit, brand } }
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

  // Match each requested item to cached prices using keyword matching
  const allPrices = {};
  for (const item of items) {
    const itemKey = item.name.toLowerCase().trim();
    const keyword = itemKey.split(' ')[0]; // first word for fuzzy match

    // Try exact match first, then keyword match
    let matched = cacheMap[itemKey];
    if (!matched) {
      // Find any cache entry whose name contains the first keyword
      const matchKey = Object.keys(cacheMap).find(k => k.includes(keyword) || keyword.includes(k.split(' ')[0]));
      if (matchKey) matched = cacheMap[matchKey];
    }

    if (matched) allPrices[item.name] = matched;
  }

  // Build per-store baskets
  const storeBaskets = {};
  for (const store of NJ_STORES) {
    let total = 0;
    let matchCount = 0;
    const storeItems = [];
    for (const item of items) {
      const cached = allPrices[item.name]?.[store];
      if (cached) {
        const linePrice = cached.price * (item.quantity || 1);
        total += linePrice;
        matchCount++;
        storeItems.push({
          name: item.name,
          price: linePrice.toFixed(2),
          unit: cached.unit,
          brand: cached.brand || null,
        });
      }
    }
    if (matchCount > 0) {
      storeBaskets[store] = {
        total: total.toFixed(2),
        matchCount,
        totalItems: items.length,
        coverage: Math.round((matchCount / items.length) * 100),
        items: storeItems,
      };
    }
  }

  // Cache freshness
  const newest = allRows[0]?.updated_at || null;
  const cacheAgeHours = newest
    ? Math.round((Date.now() - new Date(newest).getTime()) / 3600000)
    : null;

  return res.status(200).json({
    storeBaskets,
    lastUpdated: newest,
    cacheAgeHours,
    hasData: Object.keys(storeBaskets).length > 0,
  });
}
