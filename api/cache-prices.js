// PantryOS — Nightly NJ price cache builder
// Fetches prices from ShopRite, Stop & Shop, Wegmans, Acme for ~150 common items
// Runs nightly via Vercel cron. Results stored in Supabase price_cache table.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cwqzcfrgbvxerhgwsnhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_ud37Fjjl3BfBEMpH8rTZdA_k9BTYhDD';

// NJ Store IDs / configs
const STORES = {
  shoprite: {
    name: 'ShopRite',
    // NJ store rsid — 3000 = Parsippany NJ area
    searchUrl: (term) =>
      `https://www.shoprite.com/api/2.0/page/products/search?request=%7B%22query%22%3A%22${encodeURIComponent(term)}%22%2C%22fulfillment%22%3A%22PICKUP%22%7D&storeId=3000&storePlusBannerId=39&userId=0&roleId=0&siteId=22&cid=`,
    parse: parseShopRite,
  },
  stopandshop: {
    name: 'Stop & Shop',
    searchUrl: (term) =>
      `https://stopandshop.com/api/product-list-page?params=%7B%22query%22%3A%22${encodeURIComponent(term)}%22%2C%22fulfillment%22%3A%22PICKUP%22%7D&storeId=0543`,
    parse: parseStopAndShop,
  },
  wegmans: {
    name: 'Wegmans',
    searchUrl: (term) =>
      `https://www.wegmans.com/api/product-search/v2?search=${encodeURIComponent(term)}&storeId=2289`,
    parse: parseWegmans,
  },
  acme: {
    name: 'Acme Markets',
    searchUrl: (term) =>
      `https://www.acmemarkets.com/api/2.0/page/products/search?request=%7B%22query%22%3A%22${encodeURIComponent(term)}%22%2C%22fulfillment%22%3A%22PICKUP%22%7D&storeId=1173`,
    parse: parseAcme,
  },
};

// Common NJ grocery items to cache (covers ~90% of typical pantry runs)
const ITEMS_TO_CACHE = [
  'whole milk', '2% milk', 'eggs', 'bread', 'butter', 'olive oil', 'vegetable oil',
  'chicken breast', 'ground beef', 'bacon', 'salmon', 'shrimp', 'turkey',
  'apples', 'bananas', 'oranges', 'strawberries', 'blueberries', 'grapes', 'avocado',
  'broccoli', 'spinach', 'lettuce', 'tomatoes', 'onions', 'garlic', 'potatoes',
  'carrots', 'celery', 'cucumber', 'bell peppers', 'mushrooms', 'zucchini',
  'cheddar cheese', 'mozzarella', 'parmesan', 'cream cheese', 'sour cream', 'yogurt',
  'orange juice', 'apple juice', 'coffee', 'tea', 'sparkling water', 'soda',
  'pasta', 'rice', 'flour', 'sugar', 'salt', 'pepper', 'canned tomatoes', 'tomato sauce',
  'chicken broth', 'black beans', 'chickpeas', 'peanut butter', 'jelly', 'honey',
  'cereal', 'oatmeal', 'granola bars', 'crackers', 'chips', 'cookies',
  'frozen pizza', 'frozen vegetables', 'ice cream',
  'dish soap', 'laundry detergent', 'paper towels', 'toilet paper', 'trash bags',
  'shampoo', 'conditioner', 'toothpaste', 'hand soap',
  'diapers', 'baby formula', 'baby food',
];

// --- Parsers for each store's response format ---

function parseShopRite(json) {
  try {
    const products = json?.results || json?.data?.products || [];
    for (const p of products) {
      const price = p?.price?.regularPrice || p?.price?.finalPrice || p?.price;
      if (price && typeof price === 'number') {
        return { price, unit: p?.price?.unitOfMeasure || null, brand: p?.brand || null };
      }
    }
  } catch (e) {}
  return null;
}

function parseStopAndShop(json) {
  try {
    const products = json?.products || json?.data?.products || json?.items || [];
    for (const p of products) {
      const price = p?.price?.regular || p?.regularPrice || p?.price;
      if (price && typeof price === 'number') {
        return { price, unit: p?.soldBy || null, brand: p?.brand || null };
      }
    }
  } catch (e) {}
  return null;
}

function parseWegmans(json) {
  try {
    const products = json?.products || json?.data || [];
    for (const p of products) {
      const price = p?.price || p?.regularPrice || p?.salePrice;
      if (price && typeof price === 'number') {
        return { price, unit: p?.unit || null, brand: p?.brandName || null };
      }
    }
  } catch (e) {}
  return null;
}

function parseAcme(json) {
  // Acme is Albertsons — same format as ShopRite (AisleOne platform)
  return parseShopRite(json);
}

// --- Fetch with anti-bot headers ---
async function fetchWithHeaders(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'no-cache',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    return null;
  }
}

// --- Price one item at one store ---
async function priceItem(storeKey, item) {
  const store = STORES[storeKey];
  const json = await fetchWithHeaders(store.searchUrl(item));
  if (!json) return null;
  return store.parse(json);
}

// --- Upsert prices into Supabase ---
async function upsertPrices(sb, store, item, result) {
  if (!result?.price) return;
  await sb.from('price_cache').upsert({
    store,
    item_name: item,
    price: result.price,
    unit: result.unit || null,
    brand: result.brand || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'store,item_name' });
}

export default async function handler(req, res) {
  // Verify cron secret to prevent unauthorized runs
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && req.method !== 'GET') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  const results = { success: 0, failed: 0, stores: {} };

  // Process each store
  for (const storeKey of Object.keys(STORES)) {
    results.stores[storeKey] = { success: 0, failed: 0 };

    // Process items in batches of 5 to avoid rate limiting
    const BATCH = 5;
    for (let i = 0; i < ITEMS_TO_CACHE.length; i += BATCH) {
      const batch = ITEMS_TO_CACHE.slice(i, i + BATCH);
      await Promise.all(batch.map(async (item) => {
        const result = await priceItem(storeKey, item);
        if (result?.price) {
          await upsertPrices(sb, STORES[storeKey].name, item, result);
          results.stores[storeKey].success++;
          results.success++;
        } else {
          results.stores[storeKey].failed++;
          results.failed++;
        }
      }));
      // Small delay between batches to be polite
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return res.status(200).json({
    message: 'Price cache updated',
    timestamp: new Date().toISOString(),
    ...results,
  });
}
