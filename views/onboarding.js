const OnboardingView = {
  step: 1,
  totalSteps: 4,
  data: {},

  render() {
    this.step = 1;
    this.data = {};
    this.renderStep();
  },

  renderStep() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="onboarding-page">
        <div class="onboarding-card">
          <div class="onboarding-header">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${(this.step / this.totalSteps) * 100}%"></div>
            </div>
            <p class="step-label">Step ${this.step} of ${this.totalSteps}</p>
          </div>
          <div id="step-content"></div>
        </div>
      </div>
    `;
    this.renderStepContent();
  },

  renderStepContent() {
    const el = document.getElementById('step-content');

    if (this.step === 1) {
      el.innerHTML = `
        <h2>Let's set up your household</h2>
        <p class="step-desc">We'll compare prices at ShopRite, Wegmans, Stop & Shop, and Acme for your area — and build your lists by aisle.</p>
        <div class="form-group">
          <label>Household name</label>
          <input type="text" id="household-name" placeholder="The Smith Family" value="${this.data.name || ''}" />
        </div>
        <div class="form-group">
          <label>ZIP code <span class="label-hint">(enables live Kroger grocery pricing)</span></label>
          <input type="text" id="household-zip" placeholder="e.g. 07675" maxlength="5" value="${this.data.zip_code || ''}" style="max-width:160px" />
        </div>
        <div class="form-group">
          <label>Number of people</label>
          <div class="counter-row">
            <button class="counter-btn" id="dec-people">−</button>
            <span id="people-count">${this.data.people || 2}</span>
            <button class="counter-btn" id="inc-people">+</button>
          </div>
        </div>
        <div class="form-group">
          <label>Number of kids under 12</label>
          <div class="counter-row">
            <button class="counter-btn" id="dec-kids">−</button>
            <span id="kids-count">${this.data.kids || 0}</span>
            <button class="counter-btn" id="inc-kids">+</button>
          </div>
        </div>
        <button class="btn-primary btn-full" id="next-btn">Continue →</button>
      `;

      let people = this.data.people || 2;
      let kids = this.data.kids || 0;

      document.getElementById('dec-people').onclick = () => { if (people > 1) { people--; document.getElementById('people-count').textContent = people; } };
      document.getElementById('inc-people').onclick = () => { people++; document.getElementById('people-count').textContent = people; };
      document.getElementById('dec-kids').onclick = () => { if (kids > 0) { kids--; document.getElementById('kids-count').textContent = kids; } };
      document.getElementById('inc-kids').onclick = () => { kids++; document.getElementById('kids-count').textContent = kids; };

      document.getElementById('next-btn').onclick = () => {
        this.data.name = document.getElementById('household-name').value || 'My Household';
        this.data.zip_code = document.getElementById('household-zip').value.trim() || null;
        this.data.people = people;
        this.data.kids = kids;
        this.nextStep();
      };

    } else if (this.step === 2) {
      const restrictions = [
        { val: 'None', label: 'None', group: null },
        { val: 'Vegetarian', label: '🥦 Vegetarian', group: null },
        { val: 'Vegan', label: '🌱 Vegan', group: null },
        { val: 'Gluten-free', label: '🌾 Gluten-free', group: 'gluten' },
        { val: 'Dairy-free', label: '🥛 Dairy-free', group: 'dairy' },
        { val: 'Nut-free', label: '🥜 Nut-free (all)', group: 'nuts' },
        { val: 'Peanut-free', label: 'Peanut-free', group: 'nuts' },
        { val: 'Tree-nut-free', label: 'Tree-nut-free', group: 'nuts' },
        { val: 'Kosher', label: '✡️ Kosher', group: null },
        { val: 'Halal', label: '☪️ Halal', group: null },
        { val: 'Low-sodium', label: '🧒 Low-sodium', group: null },
        { val: 'Diabetic-friendly', label: '📊 Diabetic-friendly', group: null },
      ];

      // Allergy expansion prompts
      const allergyExpansions = {
        'Nut-free': {
          question: 'Which nut allergies apply?',
          sub: 'We’ll make sure to flag all relevant products.',
          options: [
            { val: 'Nut-free', label: 'All nuts (peanuts + tree nuts)', recommended: true },
            { val: 'Peanut-free', label: 'Peanuts only' },
            { val: 'Tree-nut-free', label: 'Tree nuts only (almonds, cashews, walnuts, etc.)' },
          ]
        },
        'Gluten-free': {
          question: 'How strict is your gluten-free diet?',
          sub: 'This helps us pick the right products and brands.',
          options: [
            { val: 'Gluten-free', label: 'Strict (celiac or high sensitivity)', recommended: true },
            { val: 'Gluten-free', label: 'Preference (wheat-free but oats OK)' },
          ]
        },
        'Dairy-free': {
          question: 'What’s your dairy restriction?',
          sub: 'Some people avoid lactose but can handle butter or hard cheese.',
          options: [
            { val: 'Dairy-free', label: 'Fully dairy-free (vegan, allergy)', recommended: true },
            { val: 'Dairy-free', label: 'Lactose-free only (can have hard cheese/butter)' },
          ]
        },
      };

      el.innerHTML = `
        <h2>Dietary needs & allergies</h2>
        <p class="step-desc">Select all that apply — we’ll filter products and highlight safe options for your household.</p>
        <div class="chip-grid" id="dietary-chips">
          ${restrictions.map(r => `
            <button class="chip ${this.data.dietary?.includes(r.val) ? 'chip-active' : ''}" data-val="${r.val}" data-group="${r.group || ''}">${r.label}</button>
          `).join('')}
        </div>
        <div id="allergy-followup" class="allergy-followup hidden"></div>
        <div class="nav-row">
          <button class="btn-ghost" id="back-btn">← Back</button>
          <button class="btn-primary" id="next-btn">Continue →</button>
        </div>
      `;

      let selected = [...(this.data.dietary || [])];

      const showFollowup = (triggerVal) => {
        const expansion = allergyExpansions[triggerVal];
        if (!expansion) return;
        const followup = document.getElementById('allergy-followup');
        followup.innerHTML = `
          <div class="allergy-followup-inner">
            <p class="allergy-followup-q">${expansion.question}</p>
            <p class="allergy-followup-sub">${expansion.sub}</p>
            <div class="allergy-followup-options">
              ${expansion.options.map((opt, i) => `
                <button class="allergy-opt-btn ${i === 0 ? 'allergy-opt-selected' : ''}" data-val="${opt.val}" data-replace="${triggerVal}">
                  ${opt.label}
                  ${opt.recommended ? '<span class="allergy-opt-tag">Recommended</span>' : ''}
                </button>
              `).join('')}
            </div>
          </div>
        `;
        followup.classList.remove('hidden');
        followup.querySelectorAll('.allergy-opt-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            followup.querySelectorAll('.allergy-opt-btn').forEach(b => b.classList.remove('allergy-opt-selected'));
            btn.classList.add('allergy-opt-selected');
            // Swap the trigger value for the specific selected value
            const replaceVal = btn.dataset.replace;
            const newVal = btn.dataset.val;
            selected = selected.filter(s => s !== replaceVal && s !== newVal);
            selected.push(newVal);
          });
        });
      };

      document.querySelectorAll('#dietary-chips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const val = chip.dataset.val;
          if (val === 'None') {
            selected = ['None'];
            document.querySelectorAll('#dietary-chips .chip').forEach(c => c.classList.remove('chip-active'));
            chip.classList.add('chip-active');
            document.getElementById('allergy-followup').classList.add('hidden');
            return;
          }
          selected = selected.filter(s => s !== 'None');
          document.querySelector('#dietary-chips .chip[data-val="None"]').classList.remove('chip-active');
          if (selected.includes(val)) {
            selected = selected.filter(s => s !== val);
            chip.classList.remove('chip-active');
            // Hide followup if deselecting the trigger
            if (allergyExpansions[val]) {
              document.getElementById('allergy-followup').classList.add('hidden');
            }
          } else {
            selected.push(val);
            chip.classList.add('chip-active');
            // Show expansion prompt for allergy triggers
            if (allergyExpansions[val]) {
              showFollowup(val);
            }
          }
        });
      });

      document.getElementById('back-btn').onclick = () => this.prevStep();
      document.getElementById('next-btn').onclick = () => {
        this.data.dietary = selected.length ? selected : ['None'];
        this.nextStep();
      };

    } else if (this.step === 3) {
      const modes = [
        { id: 'cheapest', icon: '💰', label: 'Cheapest', desc: 'Always lowest total cost. No compromises.' },
        { id: 'balanced', icon: '⚖️', label: 'Best Balance', desc: 'Quality + value. Our most popular.' },
        { id: 'easiest', icon: '⚡', label: 'Easiest', desc: 'Fewest decisions. Same store every time.' },
      ];
      el.innerHTML = `
        <h2>What's your default mode?</h2>
        <p class="step-desc">You can always change this or override per-item.</p>
        <div class="mode-cards">
          ${modes.map(m => `
            <div class="mode-card ${this.data.mode === m.id ? 'mode-active' : ''}" data-mode="${m.id}">
              <div class="mode-icon">${m.icon}</div>
              <div class="mode-label">${m.label}</div>
              <div class="mode-desc">${m.desc}</div>
            </div>
          `).join('')}
        </div>
        <div class="nav-row">
          <button class="btn-ghost" id="back-btn">← Back</button>
          <button class="btn-primary" id="next-btn">Continue →</button>
        </div>
      `;

      let selectedMode = this.data.mode || 'balanced';
      document.querySelector(`.mode-card[data-mode="${selectedMode}"]`)?.classList.add('mode-active');

      document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
          selectedMode = card.dataset.mode;
          document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('mode-active'));
          card.classList.add('mode-active');
        });
      });

      document.getElementById('back-btn').onclick = () => this.prevStep();
      document.getElementById('next-btn').onclick = () => {
        this.data.mode = selectedMode;
        this.nextStep();
      };

    } else if (this.step === 4) {
      const budgets = ['Under $200/week', '$200–$350/week', '$350–$500/week', '$500+/week'];
      el.innerHTML = `
        <h2>Weekly grocery budget?</h2>
        <p class="step-desc">Helps us calibrate recommendations. You can update anytime.</p>
        <div class="budget-options">
          ${budgets.map(b => `
            <button class="budget-btn ${this.data.budget === b ? 'budget-active' : ''}" data-val="${b}">${b}</button>
          `).join('')}
        </div>
        <div class="nav-row">
          <button class="btn-ghost" id="back-btn">← Back</button>
          <button class="btn-primary btn-teal" id="finish-btn">Let's go →</button>
        </div>
      `;

      let selectedBudget = this.data.budget || '';
      document.querySelectorAll('.budget-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedBudget = btn.dataset.val;
          document.querySelectorAll('.budget-btn').forEach(b => b.classList.remove('budget-active'));
          btn.classList.add('budget-active');
        });
      });

      document.getElementById('back-btn').onclick = () => this.prevStep();
      document.getElementById('finish-btn').onclick = async () => {
        this.data.budget = selectedBudget || budgets[1];
        await this.saveAndFinish();
      };
    }
  },

  nextStep() {
    this.step++;
    this.renderStep();
  },

  prevStep() {
    this.step--;
    this.renderStep();
  },

  async saveAndFinish() {
    const btn = document.getElementById('finish-btn');
    btn.disabled = true;
    btn.textContent = 'Setting up...';

    const user = await Auth.getUser();
    if (!user) { Router.go('auth'); return; }

    const { error } = await DB.saveHousehold(user.id, {
      name: this.data.name,
      zip_code: this.data.zip_code || null,
      people: this.data.people,
      kids: this.data.kids,
      dietary: this.data.dietary,
      default_mode: this.data.mode,
      budget: this.data.budget,
    });

    if (error) {
      console.error('Save household error:', error);
    }

    Router.go('dashboard');
  }
};
