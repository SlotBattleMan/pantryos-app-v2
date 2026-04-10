const DashboardView = {
  household: null,
  recentDecisions: [],
  weeklyCart: null,

  async render() {
    document.getElementById('app').innerHTML = `
      <div class="app-shell">
        ${this.renderNav()}
        <main class="main-content"><div class="loading-spinner"></div></main>
      </div>
    `;
    this.bindNav();
    await this.loadData();
    if (this.household) this.renderMain();
  },

  renderNav() {
    return `
      <nav class="sidebar">
        <div class="nav-logo">
          <svg viewBox="0 0 32 32" width="28" height="28" fill="none" aria-label="PantryOS"><rect width="32" height="32" rx="8" fill="#0D9B6E"/><path d="M8 10h16M8 16h10M8 22h13" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>
          <span class="nav-brand">PantryOS</span>
        </div>
        <div class="nav-links">
          <button class="nav-link active" data-view="dashboard">Dashboard</button>
          <button class="nav-link" data-view="pantry">Pantry</button>
          <button class="nav-link" data-view="settings">Settings</button>
        </div>
        <button class="nav-signout" id="signout-btn">Sign out</button>
      </nav>
    `;
  },

  bindNav() {
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.addEventListener('click', () => Router.go(btn.dataset.view));
    });
    document.getElementById('signout-btn').addEventListener('click', async () => {
      await Auth.signOut();
      Router.go('auth');
    });
  },

  async loadData() {
    const user = await Auth.getUser();
    if (!user) { Router.go('auth'); return; }
    const { data: household } = await DB.getHousehold(user.id);
    this.household = household;
    if (!household) { Router.go('onboarding'); return; }
    const { data: decisions } = await DB.getRecentDecisions(household.id);
    this.recentDecisions = decisions || [];

    // Load weekly cart in background
    this.loadWeeklyCart(household.id);
  },

  async loadWeeklyCart(householdId) {
    try {
      const res = await fetch('/api/weekly-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId }),
      });
      if (res.ok) {
        this.weeklyCart = await res.json();
        // Re-render the weekly cart section only
        this.renderWeeklyCartSection();
      }
    } catch (e) {
      // non-critical
    }
  },

  renderWeeklyCartSection() {
    const el = document.getElementById('weekly-cart-section');
    if (!el) return;
    el.innerHTML = this.buildWeeklyCartHTML();
    this.bindWeeklyCartActions();
  },

  buildWeeklyCartHTML() {
    const wc = this.weeklyCart;
    if (!wc) return '';

    if (!wc.ready) {
      const runsLeft = wc.runsNeeded || (3 - (wc.runsSoFar || 0));
      return `
        <div class="weekly-cart-card weekly-cart-learning">
          <div class="weekly-cart-icon">🧠</div>
          <div class="weekly-cart-body">
            <h3>Learning your habits</h3>
            <p>PantryOS needs <strong>${runsLeft} more shopping run${runsLeft !== 1 ? 's' : ''}</strong> to build your personalized weekly cart. Keep going — it gets smarter with every basket.</p>
            <div class="learning-progress">
              <div class="learning-bar" style="width: ${Math.round(((3 - runsLeft) / 3) * 100)}%"></div>
            </div>
            <p class="learning-sub">${3 - runsLeft} of 3 runs completed</p>
          </div>
        </div>
      `;
    }

    const dayLabel = wc.isShoppingDay
      ? "Today is your shopping day"
      : `Your usual shopping day is ${wc.preferredDay}${wc.daysUntilNext === 1 ? ' — tomorrow' : wc.daysUntilNext <= 2 ? ` — ${wc.daysUntilNext} days away` : ''}`;

    const topItems = wc.recommendedItems.slice(0, 6);
    const remaining = wc.recommendedItems.length - topItems.length;

    const itemsHTML = topItems.map(item => {
      const brand = item.brand ? `<span class="wc-item-brand">${item.brand}</span>` : '';
      const freq = `<span class="wc-item-freq">${item.frequencyPct}% of runs</span>`;
      return `
        <div class="wc-item">
          <span class="wc-item-name">${item.name}</span>
          ${brand}
          ${freq}
        </div>
      `;
    }).join('');

    return `
      <div class="weekly-cart-card ${wc.isShoppingDay ? 'weekly-cart-today' : ''}">
        <div class="weekly-cart-header">
          <div class="weekly-cart-header-left">
            ${wc.isShoppingDay ? '<span class="wc-today-badge">🛒 Shopping day</span>' : '<span class="wc-soon-badge">📅 Coming up</span>'}
            <h3>Your weekly cart is ready</h3>
            <p class="wc-subtitle">${dayLabel} · ${wc.itemCount} items · ~$${wc.avgSpend} avg</p>
          </div>
          <div class="weekly-cart-confidence">
            <span class="wc-runs">${wc.basedOnRuns} runs</span>
            <span class="wc-runs-label">learned from</span>
          </div>
        </div>

        <div class="wc-message">
          <span class="wc-message-icon">✨</span>
          We've learned your shopping habits. Your cart is pre-loaded with your favorite brands and the best NJ pricing — ready to go.
        </div>

        <div class="wc-items-preview">
          ${itemsHTML}
          ${remaining > 0 ? `<div class="wc-item wc-item-more">+ ${remaining} more items</div>` : ''}
        </div>

        <div class="wc-actions">
          <button class="btn-primary wc-start-btn" id="wc-start-btn">Start my weekly shop →</button>
          <button class="btn-ghost wc-edit-btn" id="wc-edit-btn">Review & edit list</button>
        </div>
      </div>
    `;
  },

  bindWeeklyCartActions() {
    const startBtn = document.getElementById('wc-start-btn');
    const editBtn = document.getElementById('wc-edit-btn');

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        // Pass weekly cart items to pantry view via sessionStorage
        if (this.weeklyCart?.recommendedItems) {
          sessionStorage.setItem('pantryos_weekly_cart', JSON.stringify(this.weeklyCart.recommendedItems));
        }
        Router.go('pantry');
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (this.weeklyCart?.recommendedItems) {
          sessionStorage.setItem('pantryos_weekly_cart', JSON.stringify(this.weeklyCart.recommendedItems));
        }
        Router.go('pantry');
      });
    }
  },

  renderMain() {
    const h = this.household;
    const greeting = this.getGreeting();
    const modeLabel = { cheapest: 'Cheapest', balanced: 'Best Balance', easiest: 'Easiest' };

    document.querySelector('.main-content').innerHTML = `
      <div class="dashboard-content">
        <div class="dashboard-header">
          <div>
            <h1>${greeting}, ${h.name}</h1>
            <p class="header-sub">Your household buying agent — always learning, always optimizing.</p>
          </div>
          <div class="mode-badge">
            <span class="mode-badge-label">Default mode</span>
            <span class="mode-badge-value">${modeLabel[h.default_mode] || 'Best Balance'}</span>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-value">${h.people}</div>
            <div class="stat-label">Household members</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${this.recentDecisions.length}</div>
            <div class="stat-label">Shopping runs</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${h.budget ? h.budget.replace('/week','') : '—'}</div>
            <div class="stat-label">Weekly budget</div>
          </div>
        </div>

        <!-- Weekly cart section — populated async -->
        <div id="weekly-cart-section">
          <div class="wc-loading">
            <div class="wc-loading-dot"></div>
            <span>Analyzing your shopping habits...</span>
          </div>
        </div>

        <!-- Quick start -->
        <div class="decision-cta-card">
          <div class="cta-content">
            <h2>New basket decision</h2>
            <p>Add items and PantryOS finds the best way to buy them across ShopRite, Wegmans, Stop & Shop, and Acme.</p>
          </div>
          <button class="btn-primary btn-large" id="start-decision-btn">Get my basket →</button>
        </div>

        ${this.recentDecisions.length > 0 ? `
          <div class="section">
            <h3 class="section-title">Recent runs</h3>
            <div class="decisions-list">
              ${this.recentDecisions.map(d => `
                <div class="decision-row">
                  <div class="decision-info">
                    <span class="decision-items">${d.item_count || '—'} items</span>
                    <span class="decision-mode mode-tag-${d.mode}">${modeLabel[d.mode] || d.mode}</span>
                  </div>
                  <div class="decision-meta">
                    <span class="decision-cost">$${d.estimated_cost || '—'}</span>
                    <span class="decision-date">${this.formatDate(d.created_at)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    document.getElementById('start-decision-btn').addEventListener('click', () => Router.go('pantry'));

    // Bind weekly cart actions if already loaded
    if (this.weeklyCart) {
      this.renderWeeklyCartSection();
    }
  },

  getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  },

  formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return diff + ' days ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },
};
