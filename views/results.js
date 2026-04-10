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
      // Checkout buttons on each card
      document.querySelectorAll('.checkout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const mode = btn.dataset.mode;
          const basketData = result[mode];
          this.openCheckout(mode, basketData, result, items, household);
        });
      });

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


  openCheckout(mode, basketData, result, items, household) {
    const store = basketData?.store || this.mockStore(mode);
    const total = basketData?.total || this.mockTotal(mode);
    const allItems = items || [];

    // Store comparison
    const stores = [
      { label: 'ShopRite',  total: result?.cheapest?.total, mode: 'cheapest', emoji: '💰' },
      { label: 'Wegmans',   total: result?.balanced?.total, mode: 'balanced', emoji: '⚖️' },
      { label: 'Instacart', total: result?.easiest?.total,  mode: 'easiest',  emoji: '⚡' },
    ];
    const storeCompareHTML = stores.map(s => `
      <div class="checkout-store-row ${s.mode === mode ? 'checkout-store-selected' : ''}">
        <span class="checkout-store-emoji">${s.emoji}</span>
        <span class="checkout-store-name">${s.label}</span>
        <span class="checkout-store-total">${s.total ? '$' + s.total : '—'}</span>
        ${s.mode === mode ? '<span class="checkout-store-tag">Selected</span>' : ''}
      </div>
    `).join('');

    // Aisle list for this basket
    const enrichedItems = allItems.map(i => ({
      ...i,
      brand: basketData?.items?.find(b => b.name === i.name)?.brand || null,
    }));
    const aisles = this.buildAisleList(enrichedItems);

    const aislePreviewHTML = aisles.slice(0, 3).map(a =>
      `<span class="checkout-section-chip">${a.emoji} ${a.section} (${a.items.length})</span>`
    ).join('') + (aisles.length > 3 ? `<span class="checkout-section-chip">+${aisles.length - 3} more</span>` : '');

    // Plain text for clipboard / SMS
    const plainText = [
      'PantryOS Shopping List — ' + store,
      'Est. Total: $' + total,
      '',
      ...aisles.map(a =>
        a.section.toUpperCase() + ' (' + a.aisle + ')\n' +
        a.items.map(i => {
          const b = i.brand ? ' [' + i.brand + ']' : '';
          const q = (i.quantity || 1) > 1 ? ' x' + i.quantity : '';
          return '  □ ' + i.name + q + b;
        }).join('\n')
      ),
    ].join('\n');

    const storeUrl = this.getStoreItemUrl(store, allItems[0]?.name || 'groceries');

    const modal = document.createElement('div');
    modal.className = 'store-modal-overlay checkout-overlay';
    modal.innerHTML = `
      <div class="store-modal checkout-modal">
        <div class="store-modal-header">
          <div>
            <h3>Checkout at ${store}</h3>
            <p class="store-modal-sub">${allItems.length} items · Est. <strong>$${total}</strong></p>
          </div>
          <button class="modal-close-btn" id="checkout-close">✕</button>
        </div>

        <div class="checkout-section">
          <p class="checkout-section-label">Price comparison</p>
          <div class="checkout-store-list">${storeCompareHTML}</div>
        </div>

        <div class="checkout-section">
          <p class="checkout-section-label">Your optimized list · ${aisles.length} sections</p>
          <div class="checkout-section-chips">${aislePreviewHTML}</div>
        </div>

        <div class="checkout-actions">
          <button class="checkout-action-btn" id="co-list-btn">
            <span class="checkout-action-icon">🛒</span>
            <span class="checkout-action-text">
              <span class="checkout-action-label">View shopping list</span>
              <span class="checkout-action-sub">Aisle-by-aisle walk order</span>
            </span>
          </button>
          <button class="checkout-action-btn" id="co-copy-btn">
            <span class="checkout-action-icon">📱</span>
            <span class="checkout-action-text">
              <span class="checkout-action-label">Send to phone</span>
              <span class="checkout-action-sub">Copy list to clipboard</span>
            </span>
          </button>
          <button class="checkout-action-btn" id="co-print-btn">
            <span class="checkout-action-icon">🖨️</span>
            <span class="checkout-action-text">
              <span class="checkout-action-label">Print list</span>
              <span class="checkout-action-sub">Clean printable format</span>
            </span>
          </button>
        </div>

        <div class="checkout-instacart">
          <div class="checkout-instacart-inner">
            <span class="checkout-instacart-badge">Coming soon</span>
            <p class="checkout-instacart-text">One-tap Instacart delivery — your full basket sent directly to the app</p>
            <button class="checkout-instacart-notify" id="co-notify-btn">Notify me when it's live →</button>
          </div>
        </div>

        <div class="store-modal-footer">
          <button class="btn-ghost" id="checkout-cancel">Close</button>
          <a href="${storeUrl}" target="_blank" rel="noopener" class="btn-primary">Open ${store} →</a>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('checkout-close').addEventListener('click', close);
    document.getElementById('checkout-cancel').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    // View shopping list
    document.getElementById('co-list-btn').addEventListener('click', () => {
      close();
      this.openStoreSearch(store, null, enrichedItems);
    });

    // Copy / send to phone
    document.getElementById('co-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(plainText).then(() => {
        const btn = document.getElementById('co-copy-btn');
        if (!btn) return;
        btn.querySelector('.checkout-action-label').textContent = '✓ Copied!';
        btn.querySelector('.checkout-action-sub').textContent = 'Paste into Messages or Notes';
        setTimeout(() => {
          btn.querySelector('.checkout-action-label').textContent = 'Send to phone';
          btn.querySelector('.checkout-action-sub').textContent = 'Copy list to clipboard';
        }, 2500);
      });
    });

    // Print
    document.getElementById('co-print-btn').addEventListener('click', () => {
      const printWin = window.open('', '_blank');
      const rows = aisles.map(a => `
        <div class="section">
          <div class="section-title">${a.emoji} ${a.section} — ${a.aisle}</div>
          ${a.items.map(i => {
            const b = i.brand ? `<span class="brand">${i.brand}</span>` : '';
            const q = (i.quantity || 1) > 1 ? ` ×${i.quantity}` : '';
            return `<div class="item"><span class="check"></span> ${i.name}${q} ${b}</div>`;
          }).join('')}
        </div>`).join('');
      printWin.document.write(`<!DOCTYPE html><html><head><title>PantryOS — ${store}</title>
        <style>
          body{font-family:system-ui,sans-serif;max-width:600px;margin:40px auto;color:#111;font-size:15px}
          h1{font-size:22px;margin-bottom:4px}
          .meta{color:#666;font-size:13px;margin-bottom:28px}
          .section{margin-bottom:20px}
          .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#555;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px}
          .item{display:flex;align-items:baseline;gap:8px;padding:5px 0;border-bottom:1px solid #f0f0f0}
          .check{width:13px;height:13px;border:1.5px solid #bbb;border-radius:2px;flex-shrink:0;display:inline-block;margin-top:2px}
          .brand{font-size:12px;color:#999;margin-left:4px}
          .total{font-size:16px;font-weight:700;margin-top:24px;padding-top:12px;border-top:2px solid #ddd}
          @media print{body{margin:20px}}
        </style></head><body>
        <h1>PantryOS Shopping List</h1>
        <p class="meta">${store} · Est. $${total} · ${allItems.length} items · ${new Date().toLocaleDateString()}</p>
        ${rows}
        <div class="total">Estimated total: $${total}</div>
        </body></html>`);
      printWin.document.close();
      setTimeout(() => { printWin.focus(); printWin.print(); }, 400);
    });

    // Instacart waitlist notify
    document.getElementById('co-notify-btn').addEventListener('click', async () => {
      const entered = prompt('Enter your email to be notified when Instacart integration launches:');
      if (entered?.includes('@')) {
        try {
          await fetch('https://cwqzcfrgbvxerhgwsnhx.supabase.co/rest/v1/instacart_waitlist', {
            method: 'POST',
            headers: {
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cXpjZnJnYnZ4ZXJoZ3dzbmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTcwNjksImV4cCI6MjA5MTMzMzA2OX0.CH653qa1WD6GVgxzsuq9f4sHzEWKmagyygXaDG0lt6g',
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cXpjZnJnYnZ4ZXJoZ3dzbmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTcwNjksImV4cCI6MjA5MTMzMzA2OX0.CH653qa1WD6GVgxzsuq9f4sHzEWKmagyygXaDG0lt6g',
              'Content-Type': 'application/json',
              'Prefer': 'resolution=ignore-duplicates',
            },
            body: JSON.stringify({ email: entered, created_at: new Date().toISOString() }),
          });
        } catch(e) {}
        const btn = document.getElementById('co-notify-btn');
        if (btn) btn.textContent = "✓ You're on the list!";
      }
    });
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
        <button class="checkout-btn" data-mode="${mode}">Checkout →</button>
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
