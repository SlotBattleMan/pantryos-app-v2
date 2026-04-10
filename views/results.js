const ResultsView = {
  render(params = {}) {
    const { result, household, items } = params;
    const mode = household?.default_mode || 'balanced';

    document.getElementById('app').innerHTML = `
      <div class="app-shell">
        ${this.renderNav()}
        <main class="main-content">
          <div class="results-content">
            <div class="results-header">
              <button class="btn-ghost btn-back" id="back-btn">← Back to pantry</button>
              <div>
                <h1>Your optimal basket</h1>
                <p class="header-sub">
                  ${items?.length || 0} items · ${this.getTimestamp()}
                  ${result?.livePrices
                    ? `<span class="live-prices-badge">● Live NJ prices${result.cacheAgeHours != null ? ' · updated ' + result.cacheAgeHours + 'h ago' : ''}</span>`
                    : '<span class="estimated-prices-badge">Estimated prices</span>'
                  }
                </p>
              </div>
            </div>

            <div class="confidence-bar-section">
              <div class="confidence-label">
                <span>Decision confidence</span>
                <span class="confidence-score">${result?.confidence || 87}%</span>
              </div>
              <div class="confidence-track">
                <div class="confidence-fill" id="confidence-fill" style="width:0%"></div>
              </div>
              <p class="confidence-note">${result?.reasoning || 'Based on your household profile, dietary preferences, and item list.'}</p>
            </div>

            <div class="basket-cards">
              ${this.renderBasket('cheapest', result?.cheapest, mode)}
              ${this.renderBasket('balanced', result?.balanced, mode)}
              ${this.renderBasket('easiest', result?.easiest, mode)}
            </div>

            <div class="items-breakdown">
              <h3 class="section-title">Item breakdown</h3>
              <div class="breakdown-table">
                <div class="breakdown-header">
                  <span>Item</span>
                  <span>Cheapest</span>
                  <span>Best Balance</span>
                  <span>Easiest</span>
                </div>
                ${(items || []).map((item, i) => `
                  <div class="breakdown-row">
                    <span class="breakdown-item">
                      <span class="breakdown-item-name">${item.name}${item.quantity > 1 ? ` <span class='item-qty'>×${item.quantity}</span>` : ''}</span>
                      ${result?.cheapest?.items?.[i]?.brand ? `<span class="breakdown-brand">${result.cheapest.items[i].brand}</span>` : ''}
                    </span>
                    <span class="breakdown-price">$${result?.cheapest?.items?.[i]?.price || this.mockPrice(0.82)}</span>
                    <span class="breakdown-price">$${result?.balanced?.items?.[i]?.price || this.mockPrice(1.0)}</span>
                    <span class="breakdown-price">$${result?.easiest?.items?.[i]?.price || this.mockPrice(1.22)}</span>
                  </div>
                `).join('')}
                <div class="breakdown-row breakdown-total">
                  <span><strong>Total</strong></span>
                  <span><strong>$${result?.cheapest?.total || '—'}</strong></span>
                  <span><strong>$${result?.balanced?.total || '—'}</strong></span>
                  <span><strong>$${result?.easiest?.total || '—'}</strong></span>
                </div>
              </div>
            </div>

            <div class="results-actions">
              <button class="btn-primary btn-large" id="accept-btn">
                Shop ${this.modeLabel(mode)} basket →
              </button>
              <button class="btn-ghost" id="new-run-btn">Start a new run</button>
            </div>

            <p class="results-disclaimer">Prices are AI-estimated based on typical market rates and may differ from actual store prices. Always verify totals at checkout.</p>
          </div>
        </main>
      </div>
    `;

    this.bindNav();
    this.animateConfidence(result?.confidence || 87);

    document.getElementById('back-btn').addEventListener('click', () => Router.go('pantry'));
    document.getElementById('new-run-btn').addEventListener('click', () => Router.go('pantry'));

    // Accept button → open store search
    document.getElementById('accept-btn').addEventListener('click', () => {
      const selectedCard = document.querySelector('.basket-card.basket-selected');
      const selectedMode = selectedCard?.dataset.mode || mode;
      const store = result?.[selectedMode]?.store || this.mockStore(selectedMode);
      const itemNames = (items || []).map(i => i.name).join(', ');
      this.openStoreSearch(store, itemNames, items);
    });

    // Basket card selection
    document.querySelectorAll('.basket-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.basket-card').forEach(c => c.classList.remove('basket-selected'));
        card.classList.add('basket-selected');
        const m = card.dataset.mode;
        document.getElementById('accept-btn').textContent = `Shop ${this.modeLabel(m)} basket →`;
      });
    });
  },

  getStoreItemUrl(store, itemName) {
    const q = encodeURIComponent(itemName);
    const map = {
      'ShopRite':      `https://www.shoprite.com/sm/planning/rsid/3000/results?q=${q}`,
      'Stop & Shop':   `https://stopandshop.com/pages/search-results/index.html#q=${q}&t=product`,
      'Wegmans':       `https://www.wegmans.com/search/#q=${q}&t=product`,
      'Acme Markets':  `https://www.acmemarkets.com/shop/search-results.html?q=${q}`,
      'Instacart':     `https://www.instacart.com/store/s?k=${q}`,
      'Walmart':       `https://www.walmart.com/search?q=${q}`,
      'Whole Foods':   `https://www.wholefoodsmarket.com/search?text=${q}`,
    };
    return map[store] || `https://www.google.com/search?q=${encodeURIComponent(store + ' ' + itemName)}`;
  },

  // ── Aisle Routing Engine ───────────────────────────────────────────────
  AISLE_ORDER: [
    { section: 'Produce',               aisle: 'Aisle 1',  emoji: '\u{1F966}', keywords: ['apple','banana','orange','strawberr','blueberr','grape','avocado','broccoli','spinach','lettuce','tomato','onion','garlic','potato','carrot','celery','cucumber','pepper','mushroom','zucchini','corn','lemon','lime','peach','pineapple','watermelon','kale','arugula','asparagus','brussels','cauliflower','bean','jalapen','fruit','vegetable','veggie','produce'] },
    { section: 'Bakery & Bread',        aisle: 'Aisle 2',  emoji: '\u{1F35E}', keywords: ['bread','bagel','roll','muffin','croissant','baguette','sourdough','pita','tortilla','wrap','bun'] },
    { section: 'Deli & Cheese',         aisle: 'Aisle 3',  emoji: '\u{1F9C0}', keywords: ['deli','salami','prosciutto','brie','gouda','cheddar','mozzarella','parmesan','provolone','swiss','string cheese','boar'] },
    { section: 'Meat & Seafood',        aisle: 'Aisle 4',  emoji: '\u{1F969}', keywords: ['chicken','beef','steak','pork','lamb','turkey','bacon','sausage','hot dog','salmon','shrimp','fish','tilapia','cod','tuna','seafood','meat','ground'] },
    { section: 'Dairy & Eggs',          aisle: 'Aisle 5',  emoji: '\u{1F95B}', keywords: ['milk','egg','butter','yogurt','cream','sour cream','cottage','half and half','whipped'] },
    { section: 'Frozen',                aisle: 'Aisle 6',  emoji: '\u{1F9CA}', keywords: ['frozen','ice cream','nugget','waffle','pancake','burrito','fries','fish stick'] },
    { section: 'Beverages',             aisle: 'Aisle 7',  emoji: '\u{1F9C3}', keywords: ['juice','soda','water','sparkling','coffee','tea','beer','wine','drink','beverage','kombucha','gatorade','lemonade'] },
    { section: 'Snacks',                aisle: 'Aisle 8',  emoji: '\u{1F37F}', keywords: ['chip','cracker','cookie','pretzel','popcorn','nut','trail mix','snack','granola bar','candy','chocolate','gummy','popcorn','pita chip'] },
    { section: 'Breakfast & Cereal',    aisle: 'Aisle 9',  emoji: '\u{1F963}', keywords: ['cereal','oatmeal','granola','pancake mix','waffle mix','syrup','breakfast'] },
    { section: 'Pantry & Canned Goods', aisle: 'Aisle 10', emoji: '\u{1F96B}', keywords: ['pasta','rice','flour','sugar','salt','pepper','oil','vinegar','sauce','broth','soup','can','lentil','peanut butter','jelly','honey','spice','mayo','ketchup','mustard','dressing'] },
    { section: 'Baby & Kids',           aisle: 'Aisle 11', emoji: '\u{1F476}', keywords: ['diaper','formula','baby','wipe','pacifier'] },
    { section: 'Household & Cleaning',  aisle: 'Aisle 12', emoji: '\u{1F9F9}', keywords: ['paper towel','toilet paper','trash','foil','plastic wrap','zip','sponge','cleaning','detergent','dish soap','laundry','bleach','fabric','dryer','dishwasher'] },
    { section: 'Personal Care',         aisle: 'Aisle 13', emoji: '\u{1FA71}', keywords: ['shampoo','conditioner','body wash','soap','toothpaste','toothbrush','deodorant','razor','shaving','lotion','sunscreen','face wash','floss','mouthwash','vitamin','medicine','advil','tylenol','dry shampoo'] },
  ],

  guessSection(itemName, category) {
    const text = (itemName + ' ' + (category || '')).toLowerCase();
    for (const row of this.AISLE_ORDER) {
      if (row.keywords.some(k => text.includes(k))) return row.section;
    }
    return 'Pantry & Canned Goods';
  },

  buildAisleList(items) {
    const sectionMap = {};
    items.forEach(item => {
      const section = this.guessSection(item.name, item.category);
      if (!sectionMap[section]) sectionMap[section] = [];
      sectionMap[section].push(item);
    });
    return this.AISLE_ORDER
      .filter(row => sectionMap[row.section]?.length > 0)
      .map(row => ({ ...row, items: sectionMap[row.section] }));
  },

  openStoreSearch(store, itemNames, items) {
    const allItems = items || [];
    const aisles = this.buildAisleList(allItems);
    const storeUrl = this.getStoreItemUrl(store, allItems[0]?.name || 'groceries');
    const isDelivery = store === 'Instacart';

    // Build aisle-grouped list HTML
    const aisleHTML = aisles.map(aisle => `
      <div class="aisle-section">
        <div class="aisle-header">
          <span class="aisle-emoji">${aisle.emoji}</span>
          <span class="aisle-name">${aisle.section}</span>
          <span class="aisle-number">${aisle.aisle}</span>
        </div>
        <div class="aisle-items">
          ${aisle.items.map(item => {
            const brand = item.brand ? `<span class="aisle-item-brand">${item.brand}</span>` : '';
            const qty = (item.quantity || 1) > 1 ? `<span class="aisle-item-qty">x${item.quantity}</span>` : '';
            const searchUrl = this.getStoreItemUrl(store, item.name);
            return `
              <div class="aisle-item-row">
                <span class="aisle-check" onclick="this.classList.toggle('checked')">&#9633;</span>
                <span class="aisle-item-info">
                  <span class="aisle-item-name">${item.name}${qty}</span>
                  ${brand}
                </span>
                <a href="${searchUrl}" target="_blank" rel="noopener" class="aisle-item-search">Find \u2192</a>
              </div>`;
          }).join('')}
        </div>
      </div>
    `).join('');

    // Plain text version for copy/share
    const plainText = aisles.map(aisle =>
      aisle.section.toUpperCase() + ' (' + aisle.aisle + ')\n' +
      aisle.items.map(i => {
        const b = i.brand ? ' [' + i.brand + ']' : '';
        const q = (i.quantity || 1) > 1 ? ' x' + i.quantity : '';
        return '  \u25a1 ' + i.name + q + b;
      }).join('\n')
    ).join('\n\n');

    const modal = document.createElement('div');
    modal.className = 'store-modal-overlay';
    modal.innerHTML = `
      <div class="store-modal store-modal-wide shopping-list-modal">
        <div class="store-modal-header">
          <div>
            <h3>${isDelivery ? 'Instacart Delivery List' : store + ' Shopping List'}</h3>
            <p class="store-modal-sub">${allItems.length} items \u00b7 ${aisles.length} sections \u00b7 optimized walk order</p>
          </div>
          <button class="modal-close-btn" id="list-modal-close">\u2715</button>
        </div>
        <div class="aisle-list-scroll">
          ${aisleHTML}
        </div>
        <div class="store-modal-footer">
          <button class="btn-ghost" id="list-copy-btn">&#128203; Copy list</button>
          <a href="${storeUrl}" target="_blank" rel="noopener" class="btn-primary">Open ${store} \u2192</a>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('list-modal-close').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    document.getElementById('list-copy-btn').addEventListener('click', () => {
      const header = store + ' Shopping List\n' + '='.repeat(30) + '\n\n';
      navigator.clipboard.writeText(header + plainText).then(() => {
        const btn = document.getElementById('list-copy-btn');
        if (btn) { btn.textContent = '\u2713 Copied!'; setTimeout(() => { btn.textContent = '\u{1F4CB} Copy list'; }, 2000); }
      });
    });
  },

  renderNav() {
    return `
      <nav class="app-nav">
        <div class="nav-logo">
          <span class="logo-mark">P</span>
          <span class="logo-text">PantryOS</span>
        </div>
        <div class="nav-links">
          <button class="nav-link" data-view="dashboard">Dashboard</button>
          <button class="nav-link" data-view="pantry">Pantry</button>
          <button class="nav-link" data-view="settings">Settings</button>
        </div>
        <button class="nav-signout" id="signout-btn">Sign out</button>
      </nav>
    `;
  },

  bindNav() {
    document.getElementById('signout-btn')?.addEventListener('click', () => Auth.signOut());
    document.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => Router.go(l.dataset.view)));
  },

  renderBasket(mode, data, activeMode) {
    const labels = { cheapest: 'Cheapest', balanced: 'Best Balance', easiest: 'Easiest' };
    const icons = { cheapest: '💰', balanced: '⚖️', easiest: '⚡' };
    const isActive = mode === activeMode;
    return `
      <div class="basket-card ${isActive ? 'basket-selected' : ''}" data-mode="${mode}">
        <div class="basket-header">
          <span class="basket-icon">${icons[mode]}</span>
          <span class="basket-label">${labels[mode]}</span>
          ${isActive ? '<span class="recommended-tag">Your mode</span>' : ''}
        </div>
        <div class="basket-cost">
          <span class="cost-label">EST. GROCERY COST</span>
          <span class="cost-value">$${data?.total || this.mockTotal(mode)}</span>
          <span class="cost-per">/ this run</span>
        </div>
        <ul class="basket-highlights">
          ${(data?.highlights || this.mockHighlights(mode)).map(h => `<li>${h}</li>`).join('')}
        </ul>
        <div class="basket-store">
          <span class="store-label">Primary store</span>
          <span class="store-name">${data?.store || this.mockStore(mode)}</span>
        </div>
      </div>
    `;
  },

  animateConfidence(pct) {
    setTimeout(() => {
      const el = document.getElementById('confidence-fill');
      if (el) el.style.width = `${pct}%`;
    }, 300);
  },

  modeLabel(mode) {
    return { cheapest: 'Cheapest', balanced: 'Best Balance', easiest: 'Easiest' }[mode] || 'Optimal';
  },

  getTimestamp() {
    return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  },

  mockPrice(mult = 1) { return (Math.random() * 8 + 2 * mult).toFixed(2); },
  mockTotal(mode) { const b = { cheapest: 78, balanced: 94, easiest: 112 }; return (b[mode] + Math.floor(Math.random() * 10)).toFixed(2); },
  mockStore(mode) { return { cheapest: 'ShopRite', balanced: 'Wegmans', easiest: 'Instacart' }[mode]; },
  mockHighlights(mode) {
    return {
      cheapest: ['Lowest total spend', 'Store-brand substitutions', 'May require 2+ stops'],
      balanced: ['Best quality-to-cost ratio', 'Trusted brand selection', 'Single store run'],
      easiest: ['One app, one order', 'Same-day delivery', 'No store trips needed'],
    }[mode] || [];
  }
};
