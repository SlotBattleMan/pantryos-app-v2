const GROCERY_LIBRARY = {
  'Produce': ['Apples','Bananas','Oranges','Strawberries','Blueberries','Grapes','Lemons','Limes','Avocados','Tomatoes','Broccoli','Spinach','Kale','Lettuce','Romaine','Carrots','Celery','Cucumbers','Bell peppers','Zucchini','Onions','Garlic','Potatoes','Sweet potatoes','Corn','Mushrooms','Green beans','Asparagus','Cauliflower','Brussels sprouts','Mango','Pineapple','Watermelon','Peaches','Pears','Cherries','Raspberries','Blackberries','Ginger','Jalapeños','Cilantro','Parsley','Basil','Scallions'],
  'Dairy & Eggs': ['Whole milk','2% milk','Oat milk','Almond milk','Eggs','Butter','Cream cheese','Sour cream','Heavy cream','Half and half','Cheddar cheese','Mozzarella','Parmesan','Greek yogurt','Yogurt','Cottage cheese','American cheese','Brie','Gouda','Feta cheese','Whipped cream','Coffee creamer'],
  'Meat & Seafood': ['Chicken breast','Chicken thighs','Whole chicken','Ground beef','Ground turkey','Steak','Pork chops','Pork tenderloin','Bacon','Sausage','Italian sausage','Salmon','Tilapia','Cod','Shrimp','Tuna (canned)','Sardines','Hot dogs','Deli turkey','Deli ham','Pepperoni','Salami','Lamb chops','Veal','Bison'],
  'Bakery & Bread': ['Sandwich bread','Whole wheat bread','Sourdough','Bagels','English muffins','Tortillas','Flour tortillas','Corn tortillas','Pita bread','Hamburger buns','Hot dog buns','Dinner rolls','Croissants','Muffins','Donuts','Baguette'],
  'Pantry Staples': ['Pasta','Spaghetti','Penne','Rigatoni','Linguine','Rice','Brown rice','Jasmine rice','Quinoa','Oatmeal','Cereal','Granola','Flour','Sugar','Brown sugar','Powdered sugar','Salt','Black pepper','Olive oil','Vegetable oil','Coconut oil','Sesame oil','Vinegar','Apple cider vinegar','Soy sauce','Worcestershire sauce','Hot sauce','Ketchup','Mustard','Mayonnaise','Ranch dressing','Italian dressing','Balsamic vinegar','Chicken broth','Vegetable broth','Beef broth','Diced tomatoes (canned)','Tomato sauce','Tomato paste','Crushed tomatoes','Black beans (canned)','Chickpeas (canned)','Kidney beans','Lentils','Peanut butter','Almond butter','Jelly','Honey','Maple syrup','Baking soda','Baking powder','Vanilla extract','Breadcrumbs','Panko','Cornstarch','Yeast','Cocoa powder','Chocolate chips'],
  'Snacks': ['Chips','Tortilla chips','Salsa','Guacamole','Hummus','Crackers','Popcorn','Pretzels','Mixed nuts','Almonds','Cashews','Trail mix','Granola bars','Protein bars','Rice cakes','Peanut butter crackers','Fruit snacks','Applesauce','Beef jerky','String cheese','Olives','Pickles'],
  'Frozen': ['Frozen pizza','Frozen fries','Frozen vegetables','Frozen broccoli','Frozen peas','Frozen corn','Frozen fruit','Frozen berries','Ice cream','Frozen waffles','Frozen pancakes','Frozen chicken nuggets','Frozen burritos','Edamame','Frozen meals','Frozen fish sticks','Frozen shrimp','Frozen pot pies','Ice pops','Frozen breakfast sandwiches'],
  'Beverages': ['Water (cases)','Sparkling water','Orange juice','Apple juice','Grape juice','Coffee','Whole bean coffee','Tea bags','Green tea','Soda','Diet soda','Sports drinks','Energy drinks','Lemonade','Coconut water','Kombucha','Beer','Wine','Sparkling wine','Milk (shelf stable)'],
  'Household': ['Paper towels','Toilet paper','Dish soap','Dishwasher pods','Laundry detergent','Fabric softener','Dryer sheets','Trash bags','Ziploc bags','Sandwich bags','Aluminum foil','Plastic wrap','Parchment paper','Sponges','All-purpose cleaner','Bleach','Bathroom cleaner','Glass cleaner','Mop refills','Vacuum bags','Air freshener','Candles','Batteries','Light bulbs','Paper plates','Plastic cups','Napkins'],
  'Personal Care': ['Shampoo','Conditioner','Body wash','Bar soap','Deodorant','Toothpaste','Toothbrushes','Floss','Mouthwash','Razors','Shaving cream','Sunscreen','Lotion','Face wash','Moisturizer','Lip balm','Cotton balls','Q-tips','Nail clippers','Hair ties','Dry shampoo'],
  'Baby & Kids': ['Diapers','Pull-ups','Baby wipes','Baby food','Baby formula','Kids snacks','Juice boxes','Mac and cheese','Kids cereal','Kids yogurt pouches','Baby shampoo','Diaper cream','Baby powder'],
};

const PantryView = {
  household: null,
  items: [],
  newItems: [],
  libraryFilter: '',
  activeCategory: 'All',

  async render() {
    document.getElementById('app').innerHTML = `
      <div class="app-shell">
        ${this.renderNav()}
        <main class="main-content">
          <div class="loading-state"><div class="spinner"></div><p>Loading your pantry...</p></div>
        </main>
      </div>
    `;
    this.bindNav();
    await this.loadData();
    this.renderMain();
    this.loadSuggestions(); // non-blocking
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
          <button class="nav-link active" data-view="pantry">Pantry</button>
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
    const { data: items } = await DB.getPantryItems(household.id);
    this.items = items || [];
    this.newItems = [];
  },

  async loadSuggestions() {
    try {
      // Get past decisions
      const { data: decisions } = await DB.getRecentDecisions(this.household.id, 10);
      if (!decisions?.length) return;

      // Extract all items from past decision result_json
      const itemFrequency = {};
      const today = new Date();
      const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.getDay()];

      decisions.forEach(d => {
        const result = d.result_json || {};
        // Pull items from cheapest basket (most representative)
        const items = result.cheapest?.items || result.balanced?.items || [];
        items.forEach(item => {
          const name = item.name?.toLowerCase().trim();
          if (!name) return;
          itemFrequency[name] = (itemFrequency[name] || 0) + 1;
        });
      });

      // Sort by frequency, take top 8, exclude already-added items
      const alreadyAdded = new Set([
        ...this.items.map(i => i.name.toLowerCase()),
        ...this.newItems.map(i => i.name.toLowerCase()),
      ]);

      const suggestions = Object.entries(itemFrequency)
        .sort((a, b) => b[1] - a[1])
        .filter(([name]) => !alreadyAdded.has(name))
        .slice(0, 8)
        .map(([name]) => name);

      if (!suggestions.length) return;

      // Render suggestion chips
      const section = document.getElementById('suggestions-section');
      const chips = document.getElementById('suggestions-chips');
      const sub = document.getElementById('suggestions-sub');

      sub.textContent = `Based on your past orders · ${dayName}`;
      chips.innerHTML = suggestions.map(name => `
        <button class="suggestion-chip" data-name="${name}">
          + ${name.charAt(0).toUpperCase() + name.slice(1)}
        </button>
      `).join('');

      section.classList.remove('hidden');

      // Wire up chips
      chips.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const name = chip.dataset.name;
          this.addItemDirect(name.charAt(0).toUpperCase() + name.slice(1), '', 1);
          chip.classList.add('suggestion-chip-added');
          chip.textContent = '✓ ' + name.charAt(0).toUpperCase() + name.slice(1);
          chip.disabled = true;
        });
      });
    } catch (e) {
      // suggestions are non-critical
    }
  },

  renderMain() {
    document.querySelector('.main-content').innerHTML = `
      <div class="pantry-content">
        <div class="page-header">
          <div>
            <h1>Pantry List</h1>
            <p class="header-sub">Add what you need — PantryOS finds the best way to buy it.</p>
          </div>
          <div class="header-actions">
            <button class="btn-ghost" id="import-btn">📋 Import past order</button>
            <button class="btn-primary" id="get-basket-btn" ${this.items.length + this.newItems.length === 0 ? 'disabled' : ''}>
              Get my basket →
            </button>
          </div>
        </div>

        <!-- Smart suggestions -->
        <div id="suggestions-section" class="suggestions-section hidden">
          <div class="suggestions-header">
            <span class="suggestions-label">✨ Suggested for you</span>
            <span class="suggestions-sub" id="suggestions-sub"></span>
          </div>
          <div class="suggestions-chips" id="suggestions-chips"></div>
        </div>

        <!-- Import panel -->
        <div id="import-panel" class="import-panel hidden">
          <div class="import-header">
            <h3>Import a past order</h3>
            <p class="import-desc">Paste any Instacart, Walmart, Amazon Fresh, or grocery order below. PantryOS reads it and builds your list automatically.</p>
          </div>
          <textarea id="import-text" class="import-textarea" placeholder="Paste your order here — any format works:

Organic whole milk x2
Large eggs x1
Sourdough bread
Chicken breast 2lb
Broccoli florets
Cheddar cheese"></textarea>
          <div class="import-actions">
            <button class="btn-ghost" id="import-cancel">Cancel</button>
            <button class="btn-primary" id="import-run">Parse my order →</button>
          </div>
          <div id="import-status" class="import-status hidden"></div>
        </div>

        <!-- Manual add -->
        <div class="add-item-card">
          <div class="add-item-row">
            <div class="form-group flex-grow" style="margin-bottom:0">
              <input type="text" id="item-name" placeholder="Type any item and press Enter..." />
            </div>
            <div class="form-group qty-group" style="margin-bottom:0">
              <input type="number" id="item-qty" min="1" value="1" />
            </div>
            <button class="btn-add" id="add-item-btn">+ Add</button>
          </div>
        </div>

        <!-- Grocery library -->
        <div class="library-section">
          <div class="library-header">
            <span class="library-title">Browse 250+ groceries</span>
            <input type="text" id="library-search" class="library-search" placeholder="Search items..." />
          </div>
          <div class="category-tabs" id="category-tabs">
            <button class="cat-tab active" data-cat="All">All</button>
            ${Object.keys(GROCERY_LIBRARY).map(cat => `<button class="cat-tab" data-cat="${cat}">${cat}</button>`).join('')}
          </div>
          <div class="library-grid" id="library-grid">
            ${this.renderLibraryItems()}
          </div>
        </div>

        <!-- This run -->
        <div id="new-items-section" class="${this.newItems.length > 0 ? '' : 'hidden'}">
          <h3 class="section-title">This run <span class="count-badge" id="new-count">${this.newItems.length}</span></h3>
          <div id="new-items" class="items-list"></div>
        </div>

        <!-- Saved staples -->
        <div id="saved-items-section" class="${this.items.length > 0 ? '' : 'hidden'}">
          <div class="section-title-row">
            <h3 class="section-title">Saved staples <span class="count-badge">${this.items.length}</span></h3>
            <button class="btn-ghost btn-sm" id="clear-staples-btn">Clear all</button>
          </div>
          <p class="staples-note">These items are added to every basket run. Remove ones you no longer need regularly.</p>
          <div id="saved-items" class="items-list">
            ${this.items.map(item => this.renderItemRow(item, true)).join('')}
          </div>
        </div>

        ${this.items.length === 0 && this.newItems.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🛒</div>
            <h3>Your list is empty</h3>
            <p>Browse groceries above, type an item, or import a past order to get started.</p>
          </div>
        ` : ''}
      </div>
    `;

    this.bindActions();
  },

  renderLibraryItems(filter = '', category = 'All') {
    let items = [];
    const cats = category === 'All' ? Object.keys(GROCERY_LIBRARY) : [category];
    cats.forEach(cat => {
      GROCERY_LIBRARY[cat].forEach(name => {
        if (!filter || name.toLowerCase().includes(filter.toLowerCase())) {
          items.push({ name, category: cat });
        }
      });
    });
    if (items.length === 0) return `<div class="library-empty">No items match "${filter}"</div>`;
    return items.map(item => `
      <button class="library-item" data-name="${item.name}" data-cat="${item.category}">
        <span class="lib-name">${item.name}</span>
        <span class="lib-add">+</span>
      </button>
    `).join('');
  },

  renderItemRow(item, isSaved = false) {
    const id = item.id || item.tempId;
    const brandPref = this.household?.brand_preferences?.[item.name.toLowerCase()];
    const brandLabel = brandPref && brandPref !== 'any' ? brandPref : 'Any brand';
    const brandClass = brandPref && brandPref !== 'any' ? 'brand-tag brand-tag-set' : 'brand-tag brand-tag-any';
    return `
      <div class="item-row" data-id="${id}">
        <div class="item-info">
          <span class="item-name">${item.name}</span>
          <button class="${brandClass}" data-item="${item.name}" data-brand="${brandPref || ''}" title="Set brand preference">${brandLabel} ▾</button>
        </div>
        <div class="item-controls">
          <span class="item-qty">×${item.quantity || 1}</span>
          <button class="icon-btn ${isSaved ? 'delete-saved' : 'delete-new'}" data-id="${id}" title="Remove">✕</button>
        </div>
      </div>
    `;
  },

  async openBrandPicker(itemName, currentBrand) {
    // Curated brands per item category
    const brandOptions = {
      'milk':            ['Organic Valley', 'Horizon Organic', 'ShopRite', 'Stop & Shop', 'Wegmans', 'Fairlife', 'Lactaid'],
      'eggs':            ['Eggland\'s Best', 'Pete & Gerry\'s Organic', 'Vital Farms', 'ShopRite', 'Wegmans', 'Happy Egg'],
      'bread':           ['Arnold', 'Pepperidge Farm', 'Dave\'s Killer Bread', 'Wonder', 'Nature\'s Own', 'ShopRite'],
      'butter':          ['Land O Lakes', 'Kerrygold', 'Organic Valley', 'Wegmans', 'Challenge'],
      'olive oil':       ['Colavita', 'California Olive Ranch', 'Kirkland', 'Bertolli', 'Pompeian'],
      'chicken breast':  ['Perdue', 'Bell & Evans', 'ShopRite', 'Wegmans', 'Nature\'s Promise'],
      'ground beef':     ['ShopRite', 'Wegmans', 'Laura\'s Lean', 'Nature Farm'],
      'bacon':           ['Oscar Mayer', 'Applegate', 'Wright', 'ShopRite', 'Wegmans'],
      'salmon':          ['Atlantic', 'Wild Planet', 'ShopRite', 'Wegmans'],
      'orange juice':    ['Tropicana', 'Simply Orange', 'Florida\'s Natural', 'Minute Maid', 'ShopRite'],
      'coffee':          ['Folgers', 'Dunkin\'', 'Eight O\'Clock', 'Green Mountain', 'Starbucks', 'ShopRite'],
      'pasta':           ['Barilla', 'Ronzoni', 'De Cecco', 'Wegmans', 'ShopRite'],
      'rice':            ['Uncle Ben\'s', 'Goya', 'Lundberg', 'ShopRite', 'Wegmans'],
      'cereal':          ['Cheerios', 'Special K', 'Frosted Flakes', 'Honey Bunches of Oats', 'ShopRite'],
      'yogurt':          ['Chobani', 'Fage', 'Siggi\'s', 'Stonyfield', 'ShopRite', 'Wegmans'],
      'cheddar cheese':  ['Cabot', 'Tillamook', 'Cracker Barrel', 'ShopRite', 'Wegmans'],
      'mozzarella':      ['Polly-O', 'BelGioioso', 'Sorrento', 'ShopRite'],
      'peanut butter':   ['Jif', 'Skippy', 'Justin\'s', 'Teddie', 'ShopRite'],
      'paper towels':    ['Bounty', 'Viva', 'Brawny', 'ShopRite'],
      'toilet paper':    ['Charmin', 'Cottonelle', 'Scott', 'ShopRite'],
      'dish soap':       ['Dawn', 'Method', 'Seventh Generation', 'ShopRite'],
      'laundry detergent': ['Tide', 'Persil', 'Arm & Hammer', 'Gain', 'ShopRite'],
      'shampoo':         ['Pantene', 'Dove', 'Herbal Essences', 'TRESemmé', 'Garnier'],
      'toothpaste':      ['Colgate', 'Crest', 'Sensodyne', 'Tom\'s of Maine', 'Arm & Hammer'],
    };

    const key = itemName.toLowerCase();
    const brands = brandOptions[key] || ['Store brand', 'National brand', 'Organic option'];

    const modal = document.createElement('div');
    modal.className = 'store-modal-overlay brand-picker-overlay';
    modal.innerHTML = `
      <div class="store-modal store-modal-wide">
        <div class="store-modal-header">
          <div>
            <h3>Brand for ${itemName}</h3>
            <p class="store-modal-sub">Saved to your household — remembered every run</p>
          </div>
          <button class="modal-close-btn" id="brand-modal-close">✕</button>
        </div>
        <div class="brand-options-grid">
          <button class="brand-option-btn ${!currentBrand || currentBrand === 'any' ? 'brand-option-selected' : ''}" data-brand="any">
            <span class="brand-option-name">Any brand</span>
            <span class="brand-option-sub">Lowest available price</span>
          </button>
          ${brands.map(b => `
            <button class="brand-option-btn ${currentBrand === b ? 'brand-option-selected' : ''}" data-brand="${b}">
              <span class="brand-option-name">${b}</span>
            </button>
          `).join('')}
        </div>
        <div class="store-modal-footer">
          <button class="btn-ghost" id="brand-modal-cancel">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('brand-modal-close').addEventListener('click', close);
    document.getElementById('brand-modal-cancel').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    // Handle brand selection
    modal.querySelectorAll('.brand-option-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const selected = btn.dataset.brand;
        close();

        // Save to household brand_preferences
        if (!this.household.brand_preferences) this.household.brand_preferences = {};
        if (selected === 'any') {
          delete this.household.brand_preferences[key];
        } else {
          this.household.brand_preferences[key] = selected;
        }

        // Persist to Supabase
        await DB.saveBrandPreferences(this.household.id, this.household.brand_preferences);

        // Update all item rows that match this item name
        document.querySelectorAll(`.brand-tag[data-item="${itemName}"]`).forEach(tag => {
          if (selected === 'any') {
            tag.textContent = 'Any brand ▾';
            tag.className = 'brand-tag brand-tag-any';
          } else {
            tag.textContent = selected + ' ▾';
            tag.className = 'brand-tag brand-tag-set';
          }
          tag.dataset.brand = selected === 'any' ? '' : selected;
        });
      });
    });
  },

  bindActions() {
    document.getElementById('add-item-btn').addEventListener('click', () => this.addItem());
    document.getElementById('item-name').addEventListener('keydown', e => { if (e.key === 'Enter') this.addItem(); });
    document.getElementById('get-basket-btn').addEventListener('click', () => this.runDecision());

    document.getElementById('import-btn').addEventListener('click', () => {
      document.getElementById('import-panel').classList.remove('hidden');
      document.getElementById('import-text').focus();
    });
    document.getElementById('import-cancel').addEventListener('click', () => {
      document.getElementById('import-panel').classList.add('hidden');
    });
    document.getElementById('import-run').addEventListener('click', () => this.runImport());

    document.getElementById('library-search').addEventListener('input', e => {
      this.libraryFilter = e.target.value;
      document.getElementById('library-grid').innerHTML = this.renderLibraryItems(this.libraryFilter, this.activeCategory);
      this.bindLibraryItems();
    });

    document.getElementById('category-tabs').addEventListener('click', e => {
      const tab = e.target.closest('.cat-tab');
      if (!tab) return;
      this.activeCategory = tab.dataset.cat;
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('library-grid').innerHTML = this.renderLibraryItems(this.libraryFilter, this.activeCategory);
      this.bindLibraryItems();
    });

    this.bindLibraryItems();

    // Brand tag clicks — delegate from document for both saved + new items
    document.addEventListener('click', e => {
      const tag = e.target.closest('.brand-tag');
      if (!tag) return;
      this.openBrandPicker(tag.dataset.item, tag.dataset.brand || '');
    }, { capture: false });

    document.getElementById('saved-items')?.addEventListener('click', async e => {
      const btn = e.target.closest('.delete-saved');
      if (!btn) return;
      const id = btn.dataset.id;
      await DB.deletePantryItem(id);
      this.items = this.items.filter(i => i.id !== id);
      document.querySelector(`.item-row[data-id="${id}"]`)?.remove();
      this.updateBasketBtn();
      if (this.items.length === 0) document.getElementById('saved-items-section').classList.add('hidden');
    });

    document.getElementById('clear-staples-btn')?.addEventListener('click', async () => {
      if (!confirm('Remove all saved staples? This cannot be undone.')) return;
      for (const item of this.items) await DB.deletePantryItem(item.id);
      this.items = [];
      document.getElementById('saved-items-section').classList.add('hidden');
      this.updateBasketBtn();
    });
  },

  bindLibraryItems() {
    document.querySelectorAll('.library-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.addItemDirect(btn.dataset.name, btn.dataset.cat);
        btn.classList.add('lib-added');
        btn.querySelector('.lib-add').textContent = '✓';
        setTimeout(() => {
          btn.classList.remove('lib-added');
          btn.querySelector('.lib-add').textContent = '+';
        }, 1200);
      });
    });
  },

  addItem() {
    const nameInput = document.getElementById('item-name');
    const qtyInput = document.getElementById('item-qty');
    const name = nameInput.value.trim();
    if (!name) return;
    this.addItemDirect(name, '', parseInt(qtyInput.value) || 1);
    nameInput.value = '';
    qtyInput.value = '1';
    nameInput.focus();
  },

  addItemDirect(name, category = '', quantity = 1) {
    if (this.newItems.find(i => i.name.toLowerCase() === name.toLowerCase())) return;
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const item = { tempId, name, category, quantity };
    this.newItems.push(item);

    // Hide empty state as soon as first item is added
    const emptyState = document.querySelector('.empty-state');
    if (emptyState) emptyState.style.display = 'none';

    const section = document.getElementById('new-items-section');
    section.classList.remove('hidden');
    document.getElementById('new-count').textContent = this.newItems.length;

    const listEl = document.getElementById('new-items');
    listEl.insertAdjacentHTML('beforeend', this.renderItemRow(item, false));

    listEl.querySelector(`.item-row[data-id="${tempId}"] .delete-new`).addEventListener('click', () => {
      this.newItems = this.newItems.filter(i => i.tempId !== tempId);
      document.querySelector(`.item-row[data-id="${tempId}"]`)?.remove();
      document.getElementById('new-count').textContent = this.newItems.length;
      if (this.newItems.length === 0) section.classList.add('hidden');
      this.updateBasketBtn();
    });

    this.updateBasketBtn();
  },

  updateBasketBtn() {
    const btn = document.getElementById('get-basket-btn');
    if (btn) btn.disabled = this.items.length + this.newItems.length === 0;
  },

  async runImport() {
    const text = document.getElementById('import-text').value.trim();
    if (!text) return;
    const btn = document.getElementById('import-run');
    const status = document.getElementById('import-status');
    btn.disabled = true;
    btn.textContent = 'Parsing...';
    status.className = 'import-status import-status-loading';
    status.classList.remove('hidden');
    status.textContent = '🤖 Reading your order...';

    try {
      let parsedItems = [];
      if (PANTRYOS_CONFIG.openaiKey) {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${PANTRYOS_CONFIG.openaiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: 'Extract grocery/household items from the text. Return JSON: {"items": [{"name": string, "category": string, "quantity": number}]}. Categories: Produce, Dairy & Eggs, Meat & Seafood, Bakery & Bread, Pantry Staples, Snacks, Frozen, Beverages, Household, Personal Care, Baby & Kids. Ignore prices, dates, order numbers, totals. Default quantity 1.' },
              { role: 'user', content: text }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          })
        });
        const data = await res.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
        parsedItems = parsed.items || [];
      } else {
        parsedItems = text.split('\n')
          .map(l => l.replace(/x\d+|\d+x|\$[\d.]+/gi, '').replace(/^[-•*]\s*/, '').trim())
          .filter(l => l.length > 2)
          .map(name => ({ name, category: '', quantity: 1 }));
      }

      if (!parsedItems.length) throw new Error('No items found');
      parsedItems.forEach(item => this.addItemDirect(item.name, item.category || '', item.quantity || 1));

      status.className = 'import-status import-status-success';
      status.textContent = `✓ Added ${parsedItems.length} items to your list`;
      btn.disabled = false;
      btn.textContent = 'Parse my order →';
      setTimeout(() => {
        document.getElementById('import-panel').classList.add('hidden');
        document.getElementById('import-text').value = '';
        status.classList.add('hidden');
      }, 1500);
    } catch (err) {
      status.className = 'import-status import-status-error';
      status.textContent = 'Could not parse — try a simpler format or add items manually.';
      btn.disabled = false;
      btn.textContent = 'Parse my order →';
    }
  },

  async runDecision() {
    const btn = document.getElementById('get-basket-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Analyzing...';

    try {
      const user = await Auth.getUser();
      if (!user) { Router.go('auth'); return; }

      for (const item of this.newItems) {
        await DB.savePantryItem({ household_id: this.household.id, name: item.name, category: item.category, quantity: item.quantity });
      }

      const allItems = [...this.items, ...this.newItems.map(i => ({ name: i.name, category: i.category, quantity: i.quantity }))];
      const result = await DecisionEngine.run(allItems, this.household);

      await DB.saveDecision({
        household_id: this.household.id,
        mode: this.household.default_mode || 'balanced',
        item_count: allItems.length,
        estimated_cost: result.balanced?.total || null,
        result_json: result,
      });

      Router.go('results', { result, household: this.household, items: allItems });
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Get my basket →';
      const errDiv = document.createElement('div');
      errDiv.className = 'basket-error';
      errDiv.textContent = '⚠️ Something went wrong. Please try again.';
      document.querySelector('.page-header').appendChild(errDiv);
      setTimeout(() => errDiv.remove(), 4000);
    }
  }
};
