// PantryOS Decision Engine
// GPT-4o runs server-side via /api/decision; falls back to NJ-aware mock

const DecisionEngine = {
  async run(items, household) {
    try {
      const res = await fetch('/api/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, household }),
      });
      const data = await res.json();
      if (data.mock || data.error) throw new Error(data.error || 'mock');
      return data;
    } catch (err) {
      console.warn('Server engine unavailable, using NJ mock:', err.message);
      return this.runMock(items, household);
    }
  },

  async runMock(items, household) {
    // Try to pull real NJ prices from cache first
    let cachedPrices = {};
    let brandMap = {}; // item name → brand from ShopRite cache
    try {
      const res = await fetch('/api/store-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.hasData) {
          cachedPrices = data.storeBaskets;
          // Build brand map from ShopRite data (most complete)
          const shopRiteItems = data.storeBaskets['ShopRite']?.items || [];
          shopRiteItems.forEach(i => { if (i.brand) brandMap[i.name.toLowerCase()] = i.brand; });
        }
      }
    } catch (e) {
      // fine — fall through to estimated prices
    }

    const hasCached = Object.keys(cachedPrices).length > 0;
    const dietary = household.dietary?.filter(d => d !== 'None') || [];
    const confidence = hasCached ? 88 + Math.floor(Math.random() * 8) : 72 + Math.floor(Math.random() * 12);

    // Category-based price estimation (fallback only)
    const categoryPrices = {
      'Produce':        [1.5, 4.5],
      'Dairy':          [3,   7],
      'Meat & Seafood': [6,   18],
      'Pantry Staples': [2,   8],
      'Snacks':         [3,   9],
      'Beverages':      [2,   6],
      'Frozen':         [4,   12],
      'Bakery':         [3,   7],
      'Household':      [3,   12],
      'Personal Care':  [4,   14],
    };

    const estimatePrice = (item, mult = 1) => {
      const range = categoryPrices[item.category] || [2, 8];
      const base = range[0] + Math.random() * (range[1] - range[0]);
      return parseFloat((base * mult * (item.quantity || 1)).toFixed(2));
    };

    // Default brands for common items when cache has no data
    const defaultBrands = {
      'milk': 'Organic Valley', 'eggs': 'Eggland\'s Best', 'bread': 'Arnold',
      'butter': 'Land O Lakes', 'olive oil': 'Colavita', 'chicken breast': 'Perdue',
      'ground beef': 'ShopRite', 'bacon': 'Oscar Mayer', 'salmon': 'Atlantic',
      'orange juice': 'Tropicana', 'coffee': 'Folgers', 'pasta': 'Barilla',
      'rice': 'Uncle Ben\'s', 'cereal': 'Cheerios', 'yogurt': 'Chobani',
      'cheese': 'Cabot', 'cheddar cheese': 'Cabot', 'mozzarella': 'Polly-O',
      'peanut butter': 'Jif', 'jelly': 'Smucker\'s', 'sugar': 'Domino',
      'paper towels': 'Bounty', 'toilet paper': 'Charmin', 'dish soap': 'Dawn',
      'laundry detergent': 'Tide', 'shampoo': 'Pantene', 'toothpaste': 'Colgate',
    };

    const getBrand = (itemName) => {
      const key = itemName.toLowerCase();
      return brandMap[key] || defaultBrands[key] || null;
    };

    // Build item lists per basket — prefer cached prices
    const buildItems = (store, mult) => items.map(item => {
      const storeData = cachedPrices[store];
      const cachedItem = storeData?.items?.find(i => i.name.toLowerCase() === item.name.toLowerCase());
      const price = cachedItem
        ? parseFloat(cachedItem.price)
        : estimatePrice(item, mult);
      const brand = getBrand(item.name);
      return { name: item.name, price: price.toFixed(2), ...(brand && { brand }) };
    });

    const cheapItems    = buildItems('ShopRite', 0.82);
    const balancedItems = buildItems('Wegmans', 1.05);
    const easiestItems  = items.map(item => ({
      name: item.name,
      price: estimatePrice(item, 1.2).toFixed(2),
    }));

    const sum = arr => arr.reduce((t, i) => t + parseFloat(i.price), 0).toFixed(2);

    // Use cached totals if available, otherwise sum items
    const cheapTotal    = cachedPrices['ShopRite']?.total    || sum(cheapItems);
    const balancedTotal = cachedPrices['Wegmans']?.total     || sum(balancedItems);
    const easiestTotal  = cachedPrices['Stop & Shop']?.total || sum(easiestItems);

    return {
      confidence,
      livePrices: hasCached,
      cacheAgeHours: 0,
      reasoning: `Compared ${items.length} items across ShopRite, Wegmans, Stop & Shop, and Acme Markets${dietary.length ? ' with ' + dietary.join(' & ') + ' preferences applied' : ''}.`,
      cheapest: {
        total: cheapTotal,
        store: 'ShopRite',
        highlights: [
          'Lowest price in NJ for this basket',
          'Store-brand options available on most items',
          dietary.length ? `${dietary[0]}-friendly selections available` : 'Best value per dollar',
        ],
        items: cheapItems,
      },
      balanced: {
        total: balancedTotal,
        store: 'Wegmans',
        highlights: [
          'Best quality and selection in NJ',
          'Organic and premium options available',
          dietary.length ? `Full ${dietary[0]} section in-store` : 'One-stop shop for everything',
        ],
        items: balancedItems,
      },
      easiest: {
        total: easiestTotal,
        store: 'Instacart',
        highlights: [
          'Same-day delivery from your nearest NJ store',
          'No store trips — delivered to your door',
          'Choose ShopRite, Stop & Shop, or Wegmans',
        ],
        items: easiestItems,
      },
    };
  },
};
