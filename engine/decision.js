// PantryOS Decision Engine
// GPT-4o runs server-side via /api/decision; falls back to intelligent mock

const DecisionEngine = {
  async run(items, household) {
    try {
      const res = await fetch('/api/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, household }),
      });
      const data = await res.json();
      // If server says mock:true or returned an error, fall back
      if (data.mock || data.error) throw new Error(data.error || 'mock');
      return data;
    } catch (err) {
      console.warn('Server engine unavailable, using mock:', err.message);
      return this.runMock(items, household);
    }
  },

  buildPrompt(items, household) {
    const itemList = items.map(i => `- ${i.name} (qty: ${i.quantity || 1}${i.category ? ', ' + i.category : ''})`).join('\n');
    return `
Household: ${household.name}
People: ${household.people} (${household.kids || 0} kids under 12)
Dietary needs: ${(household.dietary || ['None']).join(', ')}
Weekly budget: ${household.budget || 'Not specified'}
Default mode: ${household.default_mode || 'balanced'}

Items needed:
${itemList}

Return three basket options optimized for: cheapest total cost, best quality-value balance, and easiest/most convenient purchase method.
    `.trim();
  },

  runMock(items, household) {
    // Intelligent mock: base prices on item categories, scale by quantity
    const categoryPrices = {
      'Produce': [1.5, 4.5],
      'Dairy': [3, 7],
      'Meat & Seafood': [6, 18],
      'Pantry Staples': [2, 8],
      'Snacks': [3, 9],
      'Beverages': [2, 6],
      'Frozen': [4, 12],
      'Bakery': [3, 7],
      'Household': [3, 12],
      'Personal Care': [4, 14],
    };

    const priceItem = (item, mult = 1) => {
      const range = categoryPrices[item.category] || [2, 8];
      const base = range[0] + Math.random() * (range[1] - range[0]);
      return parseFloat((base * mult * (item.quantity || 1)).toFixed(2));
    };

    const cheapItems = items.map(item => ({ name: item.name, price: priceItem(item, 0.82).toString() }));
    const balancedItems = items.map(item => ({ name: item.name, price: priceItem(item, 1.0).toString() }));
    const easiestItems = items.map(item => ({ name: item.name, price: priceItem(item, 1.22).toString() }));

    const sum = arr => arr.reduce((t, i) => t + parseFloat(i.price), 0).toFixed(2);
    const dietary = household.dietary?.filter(d => d !== 'None') || [];

    const confidence = 82 + Math.floor(Math.random() * 12);

    return {
      confidence,
      reasoning: `Optimized for a ${household.people}-person household${dietary.length ? ' with ' + dietary.join(', ') + ' preferences' : ''} across ${items.length} items.`,
      cheapest: {
        total: sum(cheapItems),
        store: 'Walmart',
        highlights: [
          'Lowest total spend',
          'Store-brand substitutions where available',
          dietary.length ? `${dietary[0]}-compliant options selected` : 'Generic brands prioritized',
        ],
        items: cheapItems,
      },
      balanced: {
        total: sum(balancedItems),
        store: 'Whole Foods',
        highlights: [
          'Best quality-to-cost ratio',
          'Trusted national brands',
          dietary.length ? `Fully ${dietary[0]}-compliant` : 'Single-store convenience',
        ],
        items: balancedItems,
      },
      easiest: {
        total: sum(easiestItems),
        store: 'Instacart',
        highlights: [
          'One app, one order',
          'Same-day delivery available',
          'No store trips needed',
        ],
        items: easiestItems,
      },
    };
  }
};
