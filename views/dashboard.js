const DashboardView = {
  household: null,
  recentDecisions: [],

  async render() {
    document.getElementById('app').innerHTML = `
      <div class="app-shell">
        ${this.renderNav()}
        <main class="main-content">
          <div class="loading-state"><div class="spinner"></div><p>Loading your household...</p></div>
        </main>
      </div>
    `;
    this.bindNav();
    await this.loadData();
    if (this.household) this.renderMain();
  },

  renderNav() {
    return `
      <nav class="app-nav">
        <div class="nav-logo">
          <span class="logo-mark">P</span>
          <span class="logo-text">PantryOS</span>
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
    document.getElementById('signout-btn')?.addEventListener('click', () => Auth.signOut());
    document.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => Router.go(l.dataset.view)));
  },

  async loadData() {
    const user = await Auth.getUser();
    if (!user) { Router.go('auth'); return; }
    const { data: household } = await DB.getHousehold(user.id);
    this.household = household;
    if (!household) { Router.go('onboarding'); return; }
    const { data: decisions } = await DB.getRecentDecisions(household.id);
    this.recentDecisions = decisions || [];
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
            <p class="header-sub">Ready to make your next buying decision?</p>
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
            <div class="stat-label">Decisions made</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${h.budget ? h.budget.replace('/week','') : '—'}</div>
            <div class="stat-label">Weekly budget</div>
          </div>
        </div>

        <div class="decision-cta-card">
          <div class="cta-content">
            <h2>Make a buying decision</h2>
            <p>Tell PantryOS what you need and get your optimal basket in seconds.</p>
          </div>
          <button class="btn-primary btn-large" id="start-decision-btn">Get my basket →</button>
        </div>

        ${this.recentDecisions.length > 0 ? `
          <div class="section">
            <h3 class="section-title">Recent decisions</h3>
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
        ` : `
          <div class="empty-state">
            <div class="empty-icon">🛒</div>
            <h3>No decisions yet</h3>
            <p>Head to your pantry, add items, and run your first basket optimization.</p>
          </div>
        `}
      </div>
    `;

    document.getElementById('start-decision-btn').addEventListener('click', () => Router.go('pantry'));
  },

  getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  },

  formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};
