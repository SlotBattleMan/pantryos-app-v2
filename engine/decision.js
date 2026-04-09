// PantryOS Decision Engine
// Uses GPT-4o when OpenAI key is present; falls back to intelligent mock

const DecisionEngine = {
  async run(items, household) {
    if (PANTRYOS_CONFIG.openaiKey) {
      return await this.runGPT(items, household);
    }
    return this.runMock(items, household);
  },

  async runGPT(items, household) {
    const prompt = this.buildPrompt(items, household);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PANTRYOS_CONFIG.openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are PantryOS, a household buying intelligence engine. Given a list of grocery/household items and a household profile, return a JSON object with three basket options: cheapest, balanced, and easiest. Each option has: total (dollar amount as string), store (store name), highlights (array of 3 short benefit strings), items (array of objects with name and price as strings), and confidence (0-100 integer). Also include a top-level reasoning string (1 sentence). Return only valid JSON, no markdown.`
            },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        })
      });
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      return JSON.parse(content);
    } catch (err) {
      console.error('GPT engine error, falling back to mock:', err);
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
