// PantryOS — Kroger live pricing serverless function
// Flow: client_credentials token → nearest store by ZIP → price each item → return map

const KROGER_BASE = 'https://api.kroger.com';

async function getKrogerToken() {
  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${KROGER_BASE}/v1/connect/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=product.compact',
  });

  const responseText = await res.text();
  if (!res.ok) {
    console.error('Kroger token error:', res.status, responseText);
    return { error: res.status + ' ' + responseText };
  }
  const data = JSON.parse(responseText);
  return data.access_token || null;
}

async function getNearestStoreId(token, zipCode) {
  const res = await fetch(
    `${KROGER_BASE}/v1/locations?filter.zipCode.near=${zipCode}&filter.radiusInMiles=25&filter.limit=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0]?.locationId || null;
}

async function getItemPrice(token, locationId, term) {
  const encoded = encodeURIComponent(term);
  const res = await fetch(
    `${KROGER_BASE}/v1/products?filter.term=${encoded}&filter.locationId=${locationId}&filter.limit=5`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();

  // Find best match: prefer items with a price
  const products = data.data || [];
  for (const product of products) {
    for (const item of product.items || []) {
      if (item.price?.regular) {
        return {
          name: product.description,
          price: item.price.promo > 0 ? item.price.promo : item.price.regular,
          regular: item.price.regular,
          promo: item.price.promo > 0 ? item.price.promo : null,
          size: item.size || null,
          brand: product.brand || null,
        };
      }
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items, zipCode } = req.body || {};
  if (!items?.length || !zipCode) {
    return res.status(400).json({ error: 'Missing items or zipCode' });
  }

  // Get token
  const token = await getKrogerToken();
  if (!token || typeof token === 'object') {
    const hasId = !!process.env.KROGER_CLIENT_ID;
    const hasSecret = !!process.env.KROGER_CLIENT_SECRET;
    return res.status(503).json({
      error: hasId && hasSecret ? 'Kroger OAuth token request failed' : 'Kroger credentials not configured',
      debug: {
        hasClientId: hasId,
        hasClientSecret: hasSecret,
        krogerError: typeof token === 'object' ? token.error : null,
        clientIdPrefix: hasId ? process.env.KROGER_CLIENT_ID.substring(0, 12) + '...' : null,
      },
      prices: {}
    });
  }

  // Find nearest store
  const locationId = await getNearestStoreId(token, zipCode);
  if (!locationId) {
    return res.status(404).json({ error: 'No Kroger store found near ZIP', prices: {} });
  }

  // Price each item (parallel, max 10 at a time to respect rate limits)
  const BATCH = 10;
  const prices = {};
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(item => getItemPrice(token, locationId, item.name))
    );
    batch.forEach((item, idx) => {
      if (results[idx]) prices[item.name] = results[idx];
    });
  }

  return res.status(200).json({
    locationId,
    zipCode,
    priceCount: Object.keys(prices).length,
    prices,
  });
}
