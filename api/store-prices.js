// PantryOS — Store price lookup from Supabase cache
// Called by the decision engine to get cached NJ grocery prices for a basket

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cwqzcfrgbvxerhgwsnhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_ud37Fjjl3BfBEMpH8rTZdA_k9BTYhDD';

const NJ_STORES = ['ShopRite', 'Stop & Shop', 'Wegmans', 'Acme Markets'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items } = req.body || {};
  if (!items?.length) {
    return res.status(400).json({ error: 'Missing items' });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Normalize item names for fuzzy matching
  const itemNames = items.map(i => i.name.toLowerCase().trim());

  // Fetch all cached prices for these item names across all NJ stores
  // Use ilike for partial matching (e.g. "chicken breast" matches "chicken breast fillets")
  const allPrices = {};

  for (const itemName of itemNames) {
    const { data } = await sb
      .from('price_cache')
      .select('store, item_name, price, unit, brand, updated_at')
      .ilike('item_name', `%${itemName.split(' ')[0]}%`)  // match on first word
      .in('store', NJ_STORES)
      .order('updated_at', { ascending: false });

    if (data?.length) {
      allPrices[itemName] = {};
      // Group by store, take first (freshest) match per store
      for (const row of data) {
        if (!allPrices[itemName][row.store]) {
          allPrices[itemName][row.store] = {
            price: parseFloat(row.price),
            unit: row.unit,
            brand: row.brand,
            updated_at: row.updated_at,
          };
        }
      }
    }
  }

  // Build per-store basket totals
  const storeBaskets = {};
  for (const store of NJ_STORES) {
    let total = 0;
    let matchCount = 0;
    const storeItems = [];

    for (const item of items) {
      const itemName = item.name.toLowerCase().trim();
      const cached = allPrices[itemName]?.[store];
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

  // Check cache freshness
  const { data: freshness } = await sb
    .from('price_cache')
    .select('updated_at')
    .in('store', NJ_STORES)
    .order('updated_at', { ascending: false })
    .limit(1);

  const lastUpdated = freshness?.[0]?.updated_at || null;
  const cacheAge = lastUpdated
    ? Math.round((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60))
    : null;

  return res.status(200).json({
    storeBaskets,
    lastUpdated,
    cacheAgeHours: cacheAge,
    hasData: Object.keys(storeBaskets).length > 0,
  });
}
