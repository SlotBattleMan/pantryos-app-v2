// PantryOS — Weekly Cart Engine
// Analyzes past decisions to build a personalized recommended cart

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cwqzcfrgbvxerhgwsnhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cXpjZnJnYnZ4ZXJoZ3dzbmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTcwNjksImV4cCI6MjA5MTMzMzA2OX0.CH653qa1WD6GVgxzsuq9f4sHzEWKmagyygXaDG0lt6g';

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { householdId } = req.body || {};
  if (!householdId) return res.status(400).json({ error: 'Missing householdId' });

  // Fetch last 20 decisions for this household
  const decisions = await sbGet(
    `decisions?household_id=eq.${householdId}&select=result_json,created_at,mode&order=created_at.desc&limit=20`
  );

  if (!decisions?.length) {
    return res.status(200).json({ ready: false, reason: 'not_enough_data', runsNeeded: 3 });
  }

  if (decisions.length < 3) {
    return res.status(200).json({
      ready: false,
      reason: 'not_enough_data',
      runsNeeded: 3 - decisions.length,
      runsSoFar: decisions.length,
    });
  }

  // ── Analyze shopping patterns ──────────────────────────────────────────────

  // 1. Item frequency + brand preferences + avg quantity
  const itemStats = {}; // name → { count, brands: {brand: count}, totalQty }

  decisions.forEach(d => {
    const result = d.result_json || {};
    // Use cheapest basket items as the canonical item list
    const items = result.cheapest?.items || result.balanced?.items || [];
    items.forEach(item => {
      const name = item.name?.toLowerCase().trim();
      if (!name) return;
      if (!itemStats[name]) itemStats[name] = { count: 0, brands: {}, displayName: item.name };
      itemStats[name].count++;
      if (item.brand) {
        itemStats[name].brands[item.brand] = (itemStats[name].brands[item.brand] || 0) + 1;
      }
    });
  });

  // 2. Day-of-week shopping pattern
  const dayCounts = Array(7).fill(0);
  decisions.forEach(d => {
    const day = new Date(d.created_at).getDay();
    dayCounts[day]++;
  });
  const preferredDay = dayCounts.indexOf(Math.max(...dayCounts));
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDay = new Date().getDay();
  const isShoppingDay = todayDay === preferredDay;
  const daysUntilNext = ((preferredDay - todayDay + 7) % 7) || 7;

  // 3. Build recommended cart — items appearing in 50%+ of runs
  const minFrequency = Math.max(2, Math.floor(decisions.length * 0.4));
  const recommendedItems = Object.entries(itemStats)
    .filter(([, stats]) => stats.count >= minFrequency)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, stats]) => {
      // Pick most-used brand
      const topBrand = Object.entries(stats.brands).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      return {
        name: stats.displayName,
        quantity: 1,
        brand: topBrand,
        frequency: stats.count,
        frequencyPct: Math.round((stats.count / decisions.length) * 100),
      };
    });

  // 4. Preferred store mode
  const modeCounts = {};
  decisions.forEach(d => { modeCounts[d.mode] = (modeCounts[d.mode] || 0) + 1; });
  const preferredMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'balanced';

  // 5. Average spend
  const avgSpend = decisions.reduce((sum, d) => {
    const total = parseFloat(d.result_json?.[d.mode]?.total || d.result_json?.cheapest?.total || 0);
    return sum + total;
  }, 0) / decisions.length;

  return res.status(200).json({
    ready: true,
    recommendedItems,
    itemCount: recommendedItems.length,
    preferredDay: dayNames[preferredDay],
    preferredDayIndex: preferredDay,
    isShoppingDay,
    daysUntilNext: isShoppingDay ? 0 : daysUntilNext,
    preferredMode,
    avgSpend: avgSpend.toFixed(2),
    basedOnRuns: decisions.length,
    generatedAt: new Date().toISOString(),
  });
}
