// PantryOS — Allergen checker via Open Food Facts
// Looks up products by name or barcode, returns allergen and traces data
// Data source: Open Food Facts (openfoodfacts.org) — CC BY-SA 4.0
// IMPORTANT: Always show source attribution and label-check disclaimer

const OFF_BASE = 'https://world.openfoodfacts.org';
const USER_AGENT = 'PantryOS/1.0 (mvalentine.matthew@gmail.com)';

// FDA Top 9 allergen tags in Open Food Facts format
const ALLERGEN_TAG_MAP = {
  'Peanut allergy':     ['en:peanuts'],
  'Tree nut allergy':   ['en:nuts', 'en:almonds', 'en:cashews', 'en:walnuts', 'en:pecans', 'en:pistachios', 'en:hazelnuts', 'en:brazil-nuts', 'en:macadamia-nuts', 'en:pine-nuts'],
  'Milk allergy':       ['en:milk'],
  'Lactose intolerance':['en:milk'],
  'Egg allergy':        ['en:eggs'],
  'Wheat allergy':      ['en:wheat', 'en:gluten'],
  'Celiac disease':     ['en:wheat', 'en:gluten', 'en:barley', 'en:rye', 'en:oats'],
  'Soy allergy':        ['en:soybeans', 'en:soy'],
  'Fish allergy':       ['en:fish'],
  'Shellfish allergy':  ['en:crustaceans', 'en:molluscs', 'en:shellfish'],
  'Sesame allergy':     ['en:sesame-seeds', 'en:sesame'],
};

async function searchProduct(name) {
  // Search by product name — use first 3 words for better matches
  const query = name.split(' ').slice(0, 4).join(' ');
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,allergens_tags,traces_tags,allergens_from_ingredients,brands`;

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.products?.[0] || null;
}

async function lookupBarcode(barcode) {
  const url = `${OFF_BASE}/api/v2/product/${barcode}.json?fields=product_name,allergens_tags,traces_tags,allergens_from_ingredients,brands`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.status === 1 ? data.product : null;
}

function checkAllergens(product, userAllergens) {
  if (!product) return { status: 'unknown', contains: [], mayContain: [] };

  const allergenTags = product.allergens_tags || [];
  const tracesTags = product.traces_tags || [];
  const allAllergenText = (product.allergens_from_ingredients || '').toLowerCase();

  const contains = [];
  const mayContain = [];

  for (const userAllergen of userAllergens) {
    const tags = ALLERGEN_TAG_MAP[userAllergen] || [];
    const inAllergens = tags.some(t => allergenTags.includes(t) || allAllergenText.includes(t.replace('en:', '')));
    const inTraces = tags.some(t => tracesTags.includes(t));

    if (inAllergens) contains.push(userAllergen);
    else if (inTraces) mayContain.push(userAllergen);
  }

  return {
    status: contains.length > 0 ? 'contains' : mayContain.length > 0 ? 'may_contain' : 'clear',
    contains,
    mayContain,
    productName: product.product_name || null,
    brand: product.brands || null,
    source: 'Open Food Facts',
    sourceUrl: 'https://world.openfoodfacts.org',
    disclaimer: 'Allergen data sourced from Open Food Facts contributor database. Always verify on product packaging before purchase.',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { items, allergens, barcode } = req.body || {};

  if (!allergens?.length) return res.status(400).json({ error: 'Missing allergens' });

  // Single barcode lookup (from receipt scan)
  if (barcode) {
    const product = await lookupBarcode(barcode);
    const result = checkAllergens(product, allergens);
    return res.status(200).json({ [barcode]: result });
  }

  // Batch name-based lookup for pantry items
  if (!items?.length) return res.status(400).json({ error: 'Missing items or barcode' });

  const results = {};

  // Process in small batches to respect rate limits (10 search req/min)
  const BATCH = 3;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    await Promise.all(batch.map(async (item) => {
      try {
        const product = await searchProduct(item.name);
        results[item.name] = checkAllergens(product, allergens);
      } catch (e) {
        results[item.name] = { status: 'unknown', contains: [], mayContain: [], error: e.message };
      }
    }));
    // Respect 10 req/min search limit
    if (i + BATCH < items.length) await new Promise(r => setTimeout(r, 6500));
  }

  return res.status(200).json({
    results,
    source: 'Open Food Facts',
    sourceUrl: 'https://world.openfoodfacts.org',
    disclaimer: 'Allergen data sourced from Open Food Facts contributor database. Always verify on product packaging before purchase.',
  });
}
