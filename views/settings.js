const SettingsView = {
  household: null,
  user: null,

  async render() {
    document.getElementById('app').innerHTML = `
      <div class="app-shell">
        ${this.renderNav()}
        <main class="main-content">
          <div class="loading-state"><div class="spinner"></div><p>Loading settings...</p></div>
        </main>
      </div>
    `;
    this.bindNav();
    await this.loadData();
    this.renderMain();
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
          <button class="nav-link active" data-view="settings">Settings</button>
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
    this.user = await Auth.getUser();
    if (!this.user) { Router.go('auth'); return; }
    const { data } = await DB.getHousehold(this.user.id);
    this.household = data;
  },

  renderMain() {
    const h = this.household || {};
    const dietary = h.dietary || ['None'];
    const restrictions = ['None','Gluten-free','Dairy-free','Vegetarian','Vegan','Nut-free','Kosher','Halal'];
    const modes = [
      { id: 'cheapest', icon: '💰', label: 'Cheapest' },
      { id: 'balanced', icon: '⚖️', label: 'Best Balance' },
      { id: 'easiest', icon: '⚡', label: 'Easiest' },
    ];
    const budgets = ['Under $200/week','$200–$350/week','$350–$500/week','$500+/week'];

    document.querySelector('.main-content').innerHTML = `
      <div class="settings-content">
        <div class="page-header">
          <div>
            <h1>Settings</h1>
            <p class="header-sub">Manage your household profile and account.</p>
          </div>
        </div>

        <!-- Household -->
        <div class="settings-card">
          <h3 class="settings-section-title">Household</h3>
          <div class="form-group">
            <label>Household name</label>
            <input type="text" id="s-name" value="${h.name || ''}" placeholder="The Smith Family" />
          </div>
          <div class="form-group">
            <label>ZIP code <span class="label-hint">(enables live Kroger pricing)</span></label>
            <input type="text" id="s-zip" value="${h.zip_code || ''}" placeholder="e.g. 07675" maxlength="5" style="max-width:160px" />
          </div>
          <div class="settings-row">
            <div class="form-group flex-grow">
              <label>People in household</label>
              <div class="counter-row">
                <button class="counter-btn" id="s-dec-people">−</button>
                <span id="s-people">${h.people || 2}</span>
                <button class="counter-btn" id="s-inc-people">+</button>
              </div>
            </div>
            <div class="form-group flex-grow">
              <label>Kids under 12</label>
              <div class="counter-row">
                <button class="counter-btn" id="s-dec-kids">−</button>
                <span id="s-kids">${h.kids || 0}</span>
                <button class="counter-btn" id="s-inc-kids">+</button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>Weekly budget</label>
            <div class="budget-options-inline">
              ${budgets.map(b => `<button class="budget-btn-sm ${h.budget === b ? 'budget-active' : ''}" data-val="${b}">${b}</button>`).join('')}
            </div>
          </div>
        </div>

        <!-- Default mode -->
        <div class="settings-card">
          <h3 class="settings-section-title">Default buying mode</h3>
          <div class="mode-cards-inline">
            ${modes.map(m => `
              <div class="mode-card-sm ${h.default_mode === m.id ? 'mode-active' : ''}" data-mode="${m.id}">
                <span class="mode-icon">${m.icon}</span>
                <span class="mode-label">${m.label}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Dietary -->
        <div class="settings-card">
          <h3 class="settings-section-title">Dietary preferences</h3>
          <div class="chip-grid">
            ${restrictions.map(r => `
              <button class="chip ${dietary.includes(r) ? 'chip-active' : ''}" data-val="${r}">${r}</button>
            `).join('')}
          </div>
        </div>

        <div id="settings-msg" class="settings-msg hidden"></div>
        <button class="btn-primary" id="save-settings-btn">Save changes</button>

        <!-- Account -->
        <div class="settings-card settings-card-danger">
          <h3 class="settings-section-title">Account</h3>
          <p class="settings-email">Signed in as <strong>${this.user?.email || ''}</strong></p>
          <div class="account-actions">
            <button class="btn-ghost" id="change-pw-btn">Change password</button>
            <button class="btn-danger" id="delete-account-btn">Delete account</button>
          </div>
          <div id="change-pw-form" class="hidden" style="margin-top:16px">
            <div class="form-group">
              <label>New password</label>
              <input type="password" id="new-pw" placeholder="Min. 8 characters" />
            </div>
            <div id="pw-msg" class="auth-error hidden"></div>
            <button class="btn-primary" id="save-pw-btn">Update password</button>
          </div>
        </div>
      </div>
    `;

    this.bindSettingsActions(h);
  },

  bindSettingsActions(h) {
    let people = h.people || 2;
    let kids = h.kids || 0;
    let selectedMode = h.default_mode || 'balanced';
    let selectedBudget = h.budget || '';
    let selectedDietary = [...(h.dietary || ['None'])];

    // Counters
    document.getElementById('s-dec-people').onclick = () => { if (people > 1) { people--; document.getElementById('s-people').textContent = people; } };
    document.getElementById('s-inc-people').onclick = () => { people++; document.getElementById('s-people').textContent = people; };
    document.getElementById('s-dec-kids').onclick = () => { if (kids > 0) { kids--; document.getElementById('s-kids').textContent = kids; } };
    document.getElementById('s-inc-kids').onclick = () => { kids++; document.getElementById('s-kids').textContent = kids; };

    // Budget
    document.querySelectorAll('.budget-btn-sm').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedBudget = btn.dataset.val;
        document.querySelectorAll('.budget-btn-sm').forEach(b => b.classList.remove('budget-active'));
        btn.classList.add('budget-active');
      });
    });

    // Mode
    document.querySelectorAll('.mode-card-sm').forEach(card => {
      card.addEventListener('click', () => {
        selectedMode = card.dataset.mode;
        document.querySelectorAll('.mode-card-sm').forEach(c => c.classList.remove('mode-active'));
        card.classList.add('mode-active');
      });
    });

    // Dietary
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const val = chip.dataset.val;
        if (val === 'None') {
          selectedDietary = ['None'];
          document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
          chip.classList.add('chip-active');
          return;
        }
        selectedDietary = selectedDietary.filter(s => s !== 'None');
        document.querySelector('.chip[data-val="None"]').classList.remove('chip-active');
        if (selectedDietary.includes(val)) {
          selectedDietary = selectedDietary.filter(s => s !== val);
          chip.classList.remove('chip-active');
        } else {
          selectedDietary.push(val);
          chip.classList.add('chip-active');
        }
      });
    });

    // Save
    document.getElementById('save-settings-btn').addEventListener('click', async () => {
      const btn = document.getElementById('save-settings-btn');
      const msg = document.getElementById('settings-msg');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      const { error } = await DB.saveHousehold(this.user.id, {
        name: document.getElementById('s-name').value || 'My Household',
        zip_code: document.getElementById('s-zip').value.trim() || null,
        people,
        kids,
        dietary: selectedDietary.length ? selectedDietary : ['None'],
        default_mode: selectedMode,
        budget: selectedBudget,
      });

      msg.classList.remove('hidden');
      if (error) {
        msg.className = 'settings-msg settings-msg-error';
        msg.textContent = 'Failed to save. Please try again.';
      } else {
        msg.className = 'settings-msg settings-msg-success';
        msg.textContent = '✓ Saved! Your household settings have been updated.';
      }
      btn.disabled = false;
      btn.textContent = 'Save changes';
      msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => msg.classList.add('hidden'), 4000);
    });

    // Change password toggle
    document.getElementById('change-pw-btn').addEventListener('click', () => {
      document.getElementById('change-pw-form').classList.toggle('hidden');
    });

    document.getElementById('save-pw-btn').addEventListener('click', async () => {
      const pw = document.getElementById('new-pw').value;
      const msgEl = document.getElementById('pw-msg');
      if (pw.length < 8) {
        msgEl.textContent = 'Password must be at least 8 characters.';
        msgEl.classList.remove('hidden');
        return;
      }
      const { error } = await sb.auth.updateUser({ password: pw });
      msgEl.style.color = error ? 'var(--error)' : 'var(--success)';
      msgEl.textContent = error ? error.message : '✓ Password updated.';
      msgEl.classList.remove('hidden');
    });

    // Delete account
    document.getElementById('delete-account-btn').addEventListener('click', async () => {
      if (!confirm('Are you sure? This permanently deletes your account and all household data. This cannot be undone.')) return;
      // Delete household data first, then sign out (full deletion requires admin API)
      await sb.from('pantry_items').delete().eq('household_id', this.household?.id);
      await sb.from('decisions').delete().eq('household_id', this.household?.id);
      await sb.from('households').delete().eq('user_id', this.user.id);
      await Auth.signOut();
    });
  }
};
