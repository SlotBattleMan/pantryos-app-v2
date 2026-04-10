// PantryOS — Store price lookup from Supabase cache (REST API, no npm deps)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cwqzcfrgbvxerhgwsnhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cXpjZnJnYnZ4ZXJoZ3dzbmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTcwNjksImV4cCI6MjA5MTMzMzA2OX0.CH653qa1WD6GVgxzsuq9f4sHzEWKmagyygXaDG0lt6g';
const NJ_STORES = ['ShopRite', 'Stop & Shop', 'Wegmans', 'Acme Markets'];
// Supabase REST in() filter — each value URI-encoded, comma-joined, no extra quotes
const NJ_STORES_FILTER = NJ_STORES.map(s => encodeURIComponent(s)).join(',');

async function sbFetch(path) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    console.error('sbFetch error', res.status, await res.text().catch(()=>''));
    return [];
  }
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items } = req.body || {};
  if (!items?.length) return res.status(400).json({ error: 'Missing items' });

  const allPrices = {};

  for (const item of items) {
    const keyword = item.name.toLowerCase().trim().split(' ')[0];
    const rows = await sbFetch(
      `price_cache?item_name=ilike.*${encodeURIComponent(keyword)}*&store=in.(${NJ_STORES_FILTER})&select=store,item_name,price,unit,brand,updated_at&order=updated_at.desc`
    );

    if (rows?.length) {
      allPrices[item.name] = {};
      for (const row of rows) {
        if (!allPrices[item.name][row.store]) {
          allPrices[item.name][row.store] = {
            price: parseFloat(row.price),
            unit: row.unit,
            brand: row.brand,
          };
        }
      }
    }
  }

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
        storeItems.push({ name: item.name, price: linePrice.toFixed(2), unit: cached.unit, brand: cached.brand || null });
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

  const ageRows = await sbFetch(
    `price_cache?store=in.(${NJ_STORES_FILTER})&select=updated_at&order=updated_at.desc&limit=1`
  );
  const lastUpdated = ageRows?.[0]?.updated_at || null;
  const cacheAgeHours = lastUpdated
    ? Math.round((Date.now() - new Date(lastUpdated).getTime()) / 3600000)
    : null;

  return res.status(200).json({
    storeBaskets,
    lastUpdated,
    cacheAgeHours,
    hasData: Object.keys(storeBaskets).length > 0,
  });
}
