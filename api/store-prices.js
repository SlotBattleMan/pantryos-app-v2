// PantryOS — Store price lookup from Supabase cache (REST API, no npm deps)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cwqzcfrgbvxerhgwsnhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_ud37Fjjl3BfBEMpH8rTZdA_k9BTYhDD';
const NJ_STORES = ['ShopRite', 'Stop & Shop', 'Wegmans', 'Acme Markets'];

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) return [];
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
    const storeList = NJ_STORES.map(s => `"${s}"`).join(',');
    const rows = await sbFetch(
      `price_cache?item_name=ilike.*${encodeURIComponent(keyword)}*&store=in.(${storeList})&select=store,item_name,price,unit,brand,updated_at&order=updated_at.desc`
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
        storeItems.push({ name: item.name, price: linePrice.toFixed(2), unit: cached.unit });
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
    `price_cache?store=in.(${NJ_STORES.map(s => `"${s}"`).join(',')})&select=updated_at&order=updated_at.desc&limit=1`
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
