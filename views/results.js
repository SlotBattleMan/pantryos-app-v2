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
                    <span class="breakdown-item">${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}</span>
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

  openStoreSearch(store, itemNames, items) {
    const allItems = items || [];

    // Build per-item search links for this store
    const itemLinks = allItems.map(i => {
      const url = this.getStoreItemUrl(store, i.name);
      const qty = i.quantity > 1 ? ` <span class="item-qty">×${i.quantity}</span>` : '';
      return `
        <a href="${url}" target="_blank" rel="noopener" class="store-item-link">
          <span class="store-item-name">${i.name}${qty}</span>
          <span class="store-item-search">Search →</span>
        </a>`;
    }).join('');

    // Also build a single "search all" URL using the first item as entry point
    const firstUrl = this.getStoreItemUrl(store, allItems[0]?.name || 'groceries');

    const modal = document.createElement('div');
    modal.className = 'store-modal-overlay';
    modal.innerHTML = `
      <div class="store-modal store-modal-wide">
        <div class="store-modal-header">
          <div>
            <h3>Shop at ${store}</h3>
            <p class="store-modal-sub">${allItems.length} items — click each to search on ${store}'s site</p>
          </div>
          <button class="modal-close-btn" id="modal-cancel">✕</button>
        </div>
        <div class="store-item-links">
          ${itemLinks}
        </div>
        <div class="store-modal-footer">
          <button class="btn-ghost" id="modal-cancel2">Close</button>
          <a href="${firstUrl}" target="_blank" rel="noopener" class="btn-primary">Open ${store} website →</a>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('modal-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('modal-cancel2').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
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
