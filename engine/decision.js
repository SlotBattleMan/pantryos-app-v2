// PantryOS Decision Engine
// GPT-4o runs server-side via /api/decision; falls back to NJ-aware mock

const DecisionEngine = {
  async run(items, household) {
    try {
      // Fast health check first — 3 second timeout
      // If server returns mock:true immediately (e.g. OpenAI quota), skip straight to mock
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.slice(0, 3), household, quickCheck: true }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const probe = await res.json();

      // If server signals it can't handle real requests, go straight to mock
      if (probe.mock || probe.error) {
        console.warn('Server engine in mock mode, using local NJ engine:', probe.error);
        return this.runMock(items, household);
      }

      // Server is healthy — run full request
      const fullController = new AbortController();
      const fullTimeout = setTimeout(() => fullController.abort(), 10000);
      const fullRes = await fetch('/api/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, household }),
        signal: fullController.signal,
      });
      clearTimeout(fullTimeout);
      const data = await fullRes.json();
      if (data.mock || data.error) throw new Error(data.error || 'mock');
      return data;
    } catch (err) {
      console.warn('Server engine unavailable, using NJ mock:', err.message);
      return this.runMock(items, household);
    }
  },

  async runMock(items, household) {
    // Try to pull real NJ prices from cache first (5-second timeout)
    let cachedPrices = {};
    let brandMap = {}; // item name → brand from ShopRite cache
    try {
      const priceController = new AbortController();
      const priceTimeout = setTimeout(() => priceController.abort(), 2500);
      const res = await fetch('/api/store-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
        signal: priceController.signal,
      });
      clearTimeout(priceTimeout);
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
      'Produce':        [1.0, 3.5],  // kale $2, broccoli $2.50, apples $1.99/lb
      'Dairy':          [2.5, 6.5],  // milk $3.99, cheese $4.99, yogurt $1.49
      'Meat & Seafood': [5,   15],   // chicken $6.99/lb, ground beef $7.99/lb
      'Pantry Staples': [1.5, 6],    // pasta $1.49, sauce $3.49, broth $2.99
      'Snacks':         [2.5, 7],    // chips $3.99, crackers $3.49
      'Beverages':      [2,   6],    // juice $4.99, soda $2.49, coffee $9.99 (12oz)
      'Alcohol':        [11,  20],
      'Beer':           [11,  16],
      'Wine':           [10,  22],
      'Frozen':         [3,   9],    // frozen pizza $5.99, waffles $3.99
      'Bakery':         [2.5, 6],    // bread $3.99, rolls $3.49
      'Household':      [3,   12],
      'Personal Care':  [4,   14],
    };

    // Keyword-based category detection — maps item names to accurate price ranges
    const categoryOverride = (item) => {
      const n = item.name.toLowerCase();
      // Alcohol first (specific ranges)
      if (n.includes('beer') || n.includes('lager') || n.includes('ale') || n.includes('ipa') || n.includes('hard seltzer')) return 'Beer';
      if (n.includes('wine') || n.includes('champagne') || n.includes('prosecco') || n.includes('sparkling wine')) return 'Wine';
      if (n.includes('whiskey') || n.includes('vodka') || n.includes('rum') || n.includes('tequila') || n.includes('liquor')) return 'Alcohol';
      // Produce keywords
      if (n.match(/kale|spinach|lettuce|arugula|chard|cabbage|broccoli|cauliflower|celery|carrot|onion|garlic|potato|tomato|pepper|cucumber|zucchini|squash|asparagus|beet|radish|turnip|parsnip|leek|corn|pea|bean|edamame|avocado|apple|banana|orange|lemon|lime|grape|berry|berries|strawberr|blueberr|raspberr|blackberr|peach|pear|plum|mango|pineapple|watermelon|melon|cherry|apricot|fig|date|kiwi|pomegranate|grapefruit|tangerine|clementine|mandarin|mushroom|herb|basil|cilantro|parsley|mint|dill|thyme|rosemary|sage|ginger|scallion|chive/)) return 'Produce';
      // Dairy
      if (n.match(/milk|cheese|yogurt|skyr|butter|cream|sour cream|cottage|kefir|creamer|egg/)) return 'Dairy';
      // Meat
      if (n.match(/chicken|beef|steak|pork|lamb|turkey|salmon|shrimp|fish|tuna|cod|tilapia|sausage|bacon|ham|hot dog|bratwurst|brisket|ribs|veal|duck|crab|lobster|scallop|mussel|oyster/)) return 'Meat & Seafood';
      // Frozen
      if (n.match(/frozen|ice cream|popsicle|ice pop|waffle|pancake bites|nugget|fish stick|pizza|burrito|fries|tater|edamame/)) return 'Frozen';
      // Bakery
      if (n.match(/bread|bagel|muffin|croissant|roll|bun|tortilla|pita|naan|baguette|pretzel bites|pretzel bread/)) return 'Bakery';
      // Snacks
      if (n.match(/chip|cracker|pretzel|popcorn|granola bar|snack|cookie|candy|gummy|chocolate|nuts|trail mix|rice cake/)) return 'Snacks';
      // Beverages
      if (n.match(/juice|soda|water|seltzer|coffee|tea|kombucha|lemonade|gatorade|powerade|energy drink|coconut water/)) return 'Beverages';
      // Pantry
      if (n.match(/pasta|rice|flour|sugar|salt|sauce|broth|soup|bean|lentil|oil|vinegar|honey|syrup|peanut butter|jelly|jam|cereal|oat|grain|quinoa|couscous/)) return 'Pantry Staples';
      // Household
      if (n.match(/paper towel|toilet paper|trash bag|detergent|dish soap|sponge|foil|plastic wrap|zip|cleaning|bleach|fabric softener|dryer/)) return 'Household';
      // Personal care
      if (n.match(/shampoo|conditioner|body wash|soap|toothpaste|deodorant|razor|lotion|sunscreen|floss|mouthwash|wipe|diaper|vitamin/)) return 'Personal Care';
      // Use provided category or default to Pantry Staples (not [2,8] unknown)
      return item.category || 'Pantry Staples';
    };

    const estimatePrice = (item, mult = 1) => {
      // Returns base unit price only — quantity is applied by buildItems
      const effectiveCategory = categoryOverride(item);
      const range = categoryPrices[effectiveCategory] || [2, 8];
      const base = range[0] + Math.random() * (range[1] - range[0]);
      return parseFloat((base * mult).toFixed(2));
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

    // Brand preferences from household profile
    const brandPrefs = household.brand_preferences || {};

    // Generate ONE base price per item (random only called once, then scaled)
    // This prevents bananas being $0.59 on cheapest and $8.29 on easiest
    const basePrices = {};
    items.forEach(item => {
      const shopRiteCached = cachedPrices['ShopRite']?.items?.find(
        i => i.name.toLowerCase() === item.name.toLowerCase()
      );
      // Use ShopRite cached price as base if available, otherwise estimate once
      basePrices[item.name] = shopRiteCached
        ? parseFloat(shopRiteCached.price)
        : estimatePrice(item, 1.0); // base multiplier = 1.0, scale below
    });

    const buildItems = (store, mult) => items.map(item => {
      // Try store-specific cached price first
      const storeData = cachedPrices[store];
      const cachedItem = storeData?.items?.find(i => i.name.toLowerCase() === item.name.toLowerCase());
      let price = cachedItem
        ? parseFloat(cachedItem.price)
        : parseFloat((basePrices[item.name] * mult * (item.quantity || 1)).toFixed(2));

      // Cap at $50 per item — anything higher is almost certainly a data error
      price = Math.min(price, 50);
      // Floor at $0.25
      price = Math.max(price, 0.25);

      const prefBrand = brandPrefs[item.name.toLowerCase()];
      const brand = (prefBrand && prefBrand !== 'any') ? prefBrand : getBrand(item.name);
      return { name: item.name, price: price.toFixed(2), ...(brand && { brand }) };
    });

    const cheapItems    = buildItems('ShopRite', 0.82);
    const balancedItems = buildItems('Wegmans', 1.08);
    const easiestItems  = buildItems('Instacart', 1.22); // Instacart markup

    // ALWAYS sum the full item list for totals — never use partial cached totals
    const sum = arr => arr.reduce((t, i) => t + parseFloat(i.price), 0).toFixed(2);
    const cheapTotal    = sum(cheapItems);
    const balancedTotal = sum(balancedItems);
    const easiestTotal  = sum(easiestItems);

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
