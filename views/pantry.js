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
    this.loadWeeklyCartItems(); // auto-load from dashboard if coming via weekly cart
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

  loadWeeklyCartItems() {
    const raw = sessionStorage.getItem('pantryos_weekly_cart');
    if (!raw) return;
    sessionStorage.removeItem('pantryos_weekly_cart');
    try {
      const weeklyItems = JSON.parse(raw);
      if (!weeklyItems?.length) return;

      // Show a banner
      const banner = document.createElement('div');
      banner.className = 'weekly-cart-banner';
      banner.innerHTML = `
        <span class="wc-banner-icon">✨</span>
        <span>Your weekly cart has been pre-loaded with <strong>${weeklyItems.length} items</strong> based on your shopping history.</span>
        <button class="wc-banner-dismiss" id="wc-banner-dismiss">✕</button>
      `;
      const pantryContent = document.querySelector('.pantry-content');
      if (pantryContent) pantryContent.insertBefore(banner, pantryContent.firstChild);
      document.getElementById('wc-banner-dismiss')?.addEventListener('click', () => banner.remove());

      // Add each item
      weeklyItems.forEach(item => {
        if (!item.name) return;
        // Skip items already in the saved list
        const already = this.items.some(i => i.name.toLowerCase() === item.name.toLowerCase())
          || this.newItems.some(i => i.name.toLowerCase() === item.name.toLowerCase());
        if (!already) {
          this.addItemDirect(item.name, item.category || '', item.quantity || 1);
        }
      });
    } catch(e) {}
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
            <button class="btn-ghost" id="scan-btn">📷 Scan receipt</button>
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

        <!-- Scan receipt panel -->
        <div id="scan-panel" class="import-panel hidden">
          <div class="import-header">
            <h3>📷 Scan a receipt</h3>
            <p class="import-desc">Take a photo of any grocery receipt — PantryOS reads every item, adds them to your list, and updates our price data for your store.</p>
          </div>
          <div class="scan-upload-area" id="scan-upload-area">
            <input type="file" id="receipt-file" accept="image/*" capture="environment" style="display:none" />
            <div class="scan-placeholder" id="scan-placeholder">
              <span class="scan-icon">🧵</span>
              <p class="scan-label">Tap to take a photo or choose from your library</p>
              <p class="scan-sub">Supports JPG, PNG, HEIC · Works best in good lighting</p>
            </div>
            <img id="scan-preview" class="scan-preview hidden" alt="Receipt preview" />
          </div>
          <div class="import-actions">
            <button class="btn-ghost" id="scan-cancel">Cancel</button>
            <button class="btn-ghost" id="scan-choose">Choose photo</button>
            <button class="btn-primary hidden" id="scan-run">Read receipt →</button>
          </div>
          <div id="scan-status" class="import-status hidden"></div>
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
    const qty = item.quantity || 1;
    const brandPrefRaw = this.household?.brand_preferences?.[item.name.toLowerCase()];
    const brandPref = typeof brandPrefRaw === 'object' ? brandPrefRaw?.brand : brandPrefRaw;
    const flavorPref = typeof brandPrefRaw === 'object' ? brandPrefRaw?.flavor : null;
    const brandLabel = brandPref && brandPref !== 'any'
      ? (flavorPref ? brandPref + ' · ' + flavorPref : brandPref)
      : 'Any brand';
    const brandClass = brandPref && brandPref !== 'any' ? 'brand-tag brand-tag-set' : 'brand-tag brand-tag-any';
    return `
      <div class="item-row" data-id="${id}">
        <div class="item-info">
          <span class="item-name">${item.name}</span>
          <button class="${brandClass}" data-item="${item.name}" data-brand="${brandPref || ''}" data-flavor="${flavorPref || ''}" title="Set brand preference">${brandLabel} ▾</button>
        </div>
        <div class="item-controls">
          <div class="qty-stepper">
            <button class="qty-btn qty-dec ${isSaved ? 'qty-saved' : 'qty-new'}" data-id="${id}" data-saved="${isSaved}">−</button>
            <span class="qty-val" id="qty-${id}">${qty}</span>
            <button class="qty-btn qty-inc ${isSaved ? 'qty-saved' : 'qty-new'}" data-id="${id}" data-saved="${isSaved}">+</button>
          </div>
          <button class="icon-btn ${isSaved ? 'delete-saved' : 'delete-new'}" data-id="${id}" title="Remove">✕</button>
        </div>
      </div>
    `;
  },

  // Flavor options for items where variety matters
  flavorOptions: {
    'ice cream':         ['Vanilla', 'Chocolate', 'Strawberry', 'Cookies & Cream', 'Mint Chocolate Chip', 'Rocky Road', 'Butter Pecan', 'Coffee', 'Neapolitan'],
    'frozen yogurt':     ['Vanilla', 'Chocolate', 'Strawberry', 'Mango', 'Mixed Berry', 'Skyr'],
    'skyr':              ['Plain', 'Vanilla', 'Strawberry', 'Blueberry', 'Peach', 'Mixed Berry', 'Coconut', 'Raspberry'],
    'ice pops':          ['Cherry', 'Grape', 'Orange', 'Strawberry', 'Lemon-Lime', 'Watermelon', 'Mixed Berry', 'Tropical'],
    'yogurt':            ['Plain', 'Vanilla', 'Strawberry', 'Blueberry', 'Peach', 'Mixed Berry', 'Greek', 'Honey', 'Skyr'],
    'soda':              ['Cola', 'Diet Cola', 'Lemon-Lime', 'Orange', 'Root Beer', 'Ginger Ale', 'Grape', 'Cherry'],
    'chips':             ['Original', 'BBQ', 'Sour Cream & Onion', 'Salt & Vinegar', 'Cheddar', 'Jalapeño', 'Sea Salt'],
    'potato chips':      ['Original', 'BBQ', 'Sour Cream & Onion', 'Salt & Vinegar', 'Cheddar', 'Jalapeño', 'Sea Salt'],
    'tortilla chips':    ['Original', 'Hint of Lime', 'Multigrain', 'Scoops', 'Blue Corn', 'White Corn'],
    'cookies':           ['Chocolate Chip', 'Oreo', 'Snickerdoodle', 'Oatmeal Raisin', 'Peanut Butter', 'Sugar', 'Double Chocolate'],
    'cereal':            ['Original', 'Honey Nut', 'Frosted', 'Berry', 'Cinnamon', 'Chocolate', 'Granola'],
    'oatmeal':           ['Original', 'Maple & Brown Sugar', 'Apple Cinnamon', 'Honey', 'Blueberry', 'Peaches & Cream'],
    'coffee':            ['Original Roast', 'Dark Roast', 'Medium Roast', 'Decaf', 'French Roast', 'Breakfast Blend', 'Espresso'],
    'tea':               ['Green', 'Black', 'Chamomile', 'Peppermint', 'Earl Grey', 'English Breakfast', 'Oolong', 'Herbal'],
    'sparkling water':   ['Lime', 'Lemon', 'Grapefruit', 'Peach', 'Mango', 'Coconut', 'Unflavored', 'Berry'],
    'granola bars':      ['Peanut Butter', 'Chocolate', 'Oats & Honey', 'Dark Chocolate', 'Berry', 'Almond', 'Coconut'],
    'popcorn':           ['Butter', 'Sea Salt', 'White Cheddar', 'Kettle', 'Caramel', 'Movie Theater Butter'],
    'bread':             ['White', 'Whole Wheat', 'Multigrain', 'Sourdough', 'Rye', 'Brioche', 'Potato', 'Gluten-Free'],
    'pasta':             ['Spaghetti', 'Penne', 'Rigatoni', 'Fettuccine', 'Linguine', 'Bow Tie', 'Angel Hair', 'Rotini'],
    'rice':              ['White Long Grain', 'Brown', 'Jasmine', 'Basmati', 'Wild', 'Spanish', 'Yellow'],
    'frozen pizza':      ['Pepperoni', 'Cheese', 'Supreme', 'Veggie', 'Margherita', 'BBQ Chicken', 'Meat Lovers'],
    'frozen waffles':    ['Original', 'Blueberry', 'Buttermilk', 'Whole Grain', 'Chocolate Chip', 'Cinnamon'],
    'frozen pancakes':   ['Original', 'Blueberry', 'Buttermilk', 'Whole Wheat', 'Chocolate Chip'],
    'hot dogs':          ['Beef', 'Pork & Beef', 'Uncured', 'Turkey', 'Bun Length', 'Jumbo'],
    'sausage':           ['Sweet Italian', 'Hot Italian', 'Mild', 'Chicken', 'Breakfast', 'Andouille', 'Chorizo'],
    'cream cheese':      ['Original', 'Light', 'Whipped', 'Strawberry', 'Chive & Onion', 'Garden Vegetable'],
    'hummus':            ['Classic', 'Roasted Garlic', 'Red Pepper', 'Spinach & Artichoke', 'Buffalo', 'Plain'],
    'salsa':             ['Mild', 'Medium', 'Hot', 'Mango', 'Verde', 'Black Bean & Corn'],
    'peanut butter':     ['Creamy', 'Crunchy', 'Natural', 'Reduced Fat', 'Honey'],
    'jelly':             ['Strawberry', 'Grape', 'Raspberry', 'Mixed Berry', 'Apricot', 'Blackberry'],
    'juice':             ['Orange', 'Apple', 'Grape', 'Cranberry', 'Pineapple', 'Mango', 'Vegetable'],
    'orange juice':      ['Original', 'Pulp Free', 'Low Acid', 'With Calcium', 'Homestyle'],
    'apple juice':       ['Original', 'No Sugar Added', 'Organic', 'White Grape Apple'],
    'milk':              ['Whole', '2%', '1%', 'Skim', 'Oat Milk', 'Almond Milk', 'Soy Milk', 'Lactose-Free', 'Half Gallon', 'Gallon'],
    'whole milk':        ['Whole (Gallon)', 'Whole (Half Gallon)', 'Organic', 'Grass-Fed', 'Ultra-Pasteurized'],
    '2% milk':           ['2% (Gallon)', '2% (Half Gallon)', 'Organic', 'Lactose-Free', 'Reduced Fat'],
    'eggs':              ['Large', 'Extra Large', 'Jumbo', 'Medium', 'Organic', 'Free-Range', 'Cage-Free', 'White', 'Brown'],
    'butter':            ['Salted', 'Unsalted', 'Whipped', 'Grass-Fed', 'European Style', 'Light'],
    'cheese':            ['Shredded', 'Sliced', 'Block', 'Organic', 'Reduced Fat', 'Extra Sharp'],
    'cheddar cheese':    ['Mild', 'Medium', 'Sharp', 'Extra Sharp', 'White', 'Vermont', 'Shredded', 'Sliced'],
    'mozzarella':        ['Shredded', 'Fresh', 'Sliced', 'Part-Skim', 'Whole Milk', 'Low-Moisture'],
    'chicken breast':    ['Boneless Skinless', 'Bone-In', 'Thin Sliced', 'Organic', 'Air-Chilled', 'Ground'],
    'ground beef':       ['80/20', '85/15', '90/10', '93/7', 'Lean', 'Extra Lean', 'Grass-Fed'],
    'bacon':             ['Original', 'Thick Cut', 'Center Cut', 'Turkey Bacon', 'Uncured', 'Applewood Smoked'],
    'steak':             ['Ribeye', 'NY Strip', 'Sirloin', 'Filet Mignon', 'Flank', 'Skirt', 'T-Bone'],
    'pasta sauce':       ['Marinara', 'Arrabbiata', 'Vodka', 'Bolognese', 'Basil', 'Roasted Garlic', 'Fra Diavolo'],
    'tomato sauce':      ['Marinara', 'Arrabbiata', 'Vodka', 'Bolognese', 'Basil', 'Roasted Garlic'],
    'coffee':            ['Original Roast', 'Dark Roast', 'Medium Roast', 'Decaf', 'French Roast', 'Breakfast Blend', 'Espresso'],
    'laundry detergent': ['Original', 'Free & Gentle', 'Sport', 'Color', 'HE', 'Pods', 'Liquid', 'Powder'],
  },

  // Allergy-safe brands by dietary need
  allergyFriendlyBrands: {
    'Gluten-free':      ['Bob\'s Red Mill', 'Enjoy Life', 'Udi\'s', 'Canyon Bakehouse', 'Schar', 'Banza', 'Jovial', 'Simple Mills'],
    'Dairy-free':       ['Oatly', 'Silk', 'So Delicious', 'Violife', 'Miyoko\'s', 'Califia Farms', 'Earth Balance', 'Kite Hill'],
    'Nut-free':         ['Sunbutter', 'Wow Butter', 'Enjoy Life', 'Made Good', 'Simple Mills'],
    'Peanut-free':      ['Sunbutter', 'Almond Butter Co.', 'Justin\'s Almond', 'Wow Butter', 'Enjoy Life'],
    'Tree-nut-free':    ['Jif', 'Skippy', 'Sunbutter', 'Wow Butter', 'Enjoy Life', 'Made Good'],
    'Vegan':            ['Miyoko\'s', 'Violife', 'So Delicious', 'Earth Balance', 'Oatly', 'Tofurky', 'Field Roast', 'Beyond Meat'],
    'Vegetarian':       ['Morningstar Farms', 'Gardein', 'Amy\'s', 'Boca', 'Field Roast', 'Beyond Meat'],
    'Low-sodium':       ['Mrs. Dash', 'Herb-Ox', 'Pacific Foods Low Sodium', 'Swanson Natural Goodness'],
    'Diabetic-friendly':['Lily\'s', 'Swerve', 'Bob\'s Red Mill', 'Nature\'s Own Double Fiber'],
  },

  async openBrandPicker(itemName, currentBrand, currentFlavor) {
    // Curated brands per item category
    const brandOptions = {

  // ─── PRODUCE ──────────────────────────────────────────────────────────────
  // Produce is largely sold unbranded by origin/farm, but bagged/packaged
  // produce does carry branded labels. Listed brands reflect bagged/packaged
  // options plus major grower brands found in NJ stores.

  'apples': ['Honeycrisp Farms', 'Envy', 'SweeTango', 'Gala Farms', 'Cosmic Crisp', 'ShopRite', 'Wegmans'],
  'bananas': ['Chiquita', 'Dole', 'Del Monte', 'Fyffes', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'oranges': ['Sunkist', 'Cuties', 'Halo', 'Florida\'s Natural', 'Dole', 'ShopRite', 'Wegmans'],
  'strawberries': ['Driscoll\'s', 'California Giant', 'Wish Farms', 'SunFed Produce', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'blueberries': ['Driscoll\'s', 'Naturipe', 'Wish Farms', 'SunFed Produce', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'grapes': ['Sun World', 'Sunlight', 'Grape King', 'Calmeria', 'ShopRite', 'Wegmans', 'Dole'],
  'avocado': ['Calavo', 'Mission Avocados', 'Del Monte', 'Hass Avocado Board', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'broccoli': ['Dole', 'Green Giant', 'Mann\'s', 'Ready Pac', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'spinach': ['Earthbound Farm', 'Dole', 'Taylor Farms', 'Olivia\'s Organics', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'lettuce': ['Dole', 'Taylor Farms', 'Fresh Express', 'Earthbound Farm', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'tomatoes': ['Sunset', 'NatureSweet', 'Backyard Farms', 'BrightFarms', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'onions': ['Gills Onions', 'ProSource', 'Bland Farms', 'Dole', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'garlic': ['Christopher Ranch', 'Spice World', 'Melissa\'s', 'Fresh Garlic Company', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'potatoes': ['Russet Farms', 'Potandon', 'Little Potato Company', 'Melissa\'s', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'carrots': ['Bolthouse Farms', 'Grimmway Farms', 'Cal-Organic', 'Dole', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'celery': ['Dole', 'Mann\'s', 'Growers Express', 'Taylor Farms', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'cucumber': ['NatureSweet', 'Sunset', 'Mucci Farms', 'ShopRite', 'Wegmans', 'Stop & Shop', 'Acme'],
  'bell peppers': ['Sunset', 'NatureSweet', 'Pero Family Farms', 'Village Farms', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'mushrooms': ['Giorgio', 'Monterey', 'Whitecrest', 'ShopRite', 'Wegmans', 'Stop & Shop', 'Acme'],
  'zucchini': ['Pero Family Farms', 'Growers Express', 'Mann\'s', 'ShopRite', 'Wegmans', 'Stop & Shop', 'Acme'],
  'corn': ['Dole', 'Green Giant', 'Pero Family Farms', 'Growers Express', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'sweet potatoes': ['Covington', 'Melissa\'s', 'Muranaka Farm', 'ShopRite', 'Wegmans', 'Stop & Shop', 'Acme'],
  'lemons': ['Sunkist', 'Melissa\'s', 'Sun Pacific', 'ShopRite', 'Wegmans', 'Stop & Shop', 'Dole'],
  'limes': ['Sunkist', 'Melissa\'s', 'Sun Pacific', 'ShopRite', 'Wegmans', 'Stop & Shop', 'Dole'],
  'peaches': ['Wawona', 'Titan Farms', 'Dole', 'ShopRite', 'Wegmans', 'Stop & Shop', 'Acme'],
  'pineapple': ['Dole', 'Del Monte', 'Chiquita', 'Melissa\'s', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'watermelon': ['Dulcinea', 'Dole', 'Del Monte', 'ShopRite', 'Wegmans', 'Stop & Shop', 'Acme'],
  'kale': ['Earthbound Farm', 'Dole', 'Taylor Farms', 'Olivia\'s Organics', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'arugula': ['Earthbound Farm', 'Taylor Farms', 'Olivia\'s Organics', 'Little Leaf Farms', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'romaine lettuce': ['Dole', 'Fresh Express', 'Taylor Farms', 'Earthbound Farm', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'asparagus': ['Gourmet Trading', 'Pero Family Farms', 'Del Monte', 'ShopRite', 'Wegmans', 'Stop & Shop', 'Acme'],
  'brussels sprouts': ['Mann\'s', 'Earthbound Farm', 'Growers Express', 'ShopRite', 'Wegmans', 'Stop & Shop', 'Acme'],
  'cauliflower': ['Mann\'s', 'Growers Express', 'Earthbound Farm', 'Dole', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'green beans': ['Growers Express', 'Pero Family Farms', 'Del Monte', 'Dole', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'jalapeños': ['Melissa\'s', 'Pero Family Farms', 'NatureSweet', 'ShopRite', 'Wegmans', 'Stop & Shop', 'Acme'],

  // ─── DAIRY ────────────────────────────────────────────────────────────────

  'whole milk': ['Organic Valley', 'Horizon Organic', 'Fairlife', 'Lactaid', 'Tuscan', 'ShopRite', 'Wegmans'],
  '2% milk': ['Organic Valley', 'Horizon Organic', 'Fairlife', 'Lactaid', 'Tuscan', 'ShopRite', 'Wegmans'],
  'eggs': ['Eggland\'s Best', 'Vital Farms', 'Pete and Gerry\'s', 'Happy Egg', 'Land O Lakes', 'ShopRite', 'Wegmans'],
  'butter': ['Land O Lakes', 'Kerrygold', 'Challenge', 'Organic Valley', 'Tillamook', 'ShopRite', 'Wegmans'],
  'cheddar cheese': ['Cabot', 'Tillamook', 'Cracker Barrel', 'Sargento', 'Kraft', 'ShopRite', 'Wegmans'],
  'mozzarella': ['Polly-O', 'BelGioioso', 'Sargento', 'Galbani', 'Kraft', 'ShopRite', 'Wegmans'],
  'parmesan': ['BelGioioso', 'Kraft', 'Sargento', 'Cello', 'Galbani', 'ShopRite', 'Wegmans'],
  'cream cheese': ['Philadelphia', 'Breakstone\'s', 'Organic Valley', 'Cabot', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'sour cream': ['Daisy', 'Breakstone\'s', 'Organic Valley', 'Hood', 'Cabot', 'ShopRite', 'Wegmans'],
  'yogurt': ['Chobani', 'Fage', 'Siggi\'s', 'Icelandic Provisions', 'Stonyfield', 'Dannon', 'Kite Hill', 'ShopRite', 'Wegmans'],
  'skyr': ['Icelandic Provisions', 'Siggi\'s', 'Chobani', 'Skyr.is', 'Wegmans', 'ShopRite'],
  'cottage cheese': ['Breakstone\'s', 'Daisy', 'Good Culture', 'Hood', 'Organic Valley', 'ShopRite', 'Wegmans'],
  'heavy cream': ['Hood', 'Organic Valley', 'Horizon Organic', 'Land O Lakes', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'half and half': ['Hood', 'Land O Lakes', 'Organic Valley', 'Horizon Organic', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'whipped cream': ['Reddi Whip', 'Cool Whip', 'Lucerne', 'Organic Valley', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'American cheese': ['Kraft', 'Land O Lakes', 'Boar\'s Head', 'Sargento', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'swiss cheese': ['Boar\'s Head', 'Sargento', 'Finlandia', 'Land O Lakes', 'Cabot', 'ShopRite', 'Wegmans'],
  'provolone': ['Boar\'s Head', 'Sargento', 'Galbani', 'Auricchio', 'BelGioioso', 'ShopRite', 'Wegmans'],
  'brie': ['President', 'Alouette', 'Ile de France', 'Fromager d\'Affinois', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'gouda': ['Boar\'s Head', 'Sargento', 'Bel Brands', 'Beemster', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'string cheese': ['Sargento', 'Polly-O', 'Frigo', 'Kraft', 'Organic Valley', 'ShopRite', 'Wegmans'],

  // ─── MEAT ─────────────────────────────────────────────────────────────────

  'chicken breast': ['Perdue', 'Tyson', 'Pilgrim\'s', 'Bell & Evans', 'Nature\'s Promise', 'ShopRite', 'Wegmans'],
  'ground beef': ['Laura\'s Lean', '80/20 Fresh', 'Certified Angus Beef', 'Pat LaFrieda', 'Nature\'s Promise', 'ShopRite', 'Wegmans'],
  'bacon': ['Oscar Mayer', 'Applegate', 'Niman Ranch', 'Hatfield', 'Boar\'s Head', 'ShopRite', 'Wegmans'],
  'salmon': ['Atlantic Sapphire', 'SeaBear', 'Ocean Beauty', 'Verlasso', 'ShopRite', 'Wegmans', 'Acme'],
  'shrimp': ['Chicken of the Sea', 'SeaPak', 'Gulf Shrimp Co.', 'Aqua Star', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'steak': ['Certified Angus Beef', 'Pat LaFrieda', 'USDA Choice', 'Laura\'s Lean', 'Nature\'s Promise', 'ShopRite', 'Wegmans'],
  'pork chops': ['Hatfield', 'Smithfield', 'Niman Ranch', 'Duroc', 'Nature\'s Promise', 'ShopRite', 'Wegmans'],
  'turkey': ['Butterball', 'Shady Brook Farms', 'Jennie-O', 'Plainville Farms', 'Nature\'s Promise', 'ShopRite', 'Wegmans'],
  'ground turkey': ['Butterball', 'Shady Brook Farms', 'Jennie-O', 'Plainville Farms', 'Nature\'s Promise', 'ShopRite', 'Wegmans'],
  'hot dogs': ['Nathan\'s Famous', 'Sabrett', 'Boar\'s Head', 'Hebrew National', 'Oscar Mayer', 'ShopRite', 'Wegmans'],
  'sausage': ['Hatfield', 'Johnsonville', 'Aidells', 'Boar\'s Head', 'Premio', 'ShopRite', 'Wegmans'],
  'lamb': ['American Lamb Board', 'Certified American', 'Shepherd\'s Lamb', 'Niman Ranch', 'ShopRite', 'Wegmans', 'Acme'],
  'tilapia': ['Regal Springs', 'Aqua Star', 'Captain\'s Choice', 'ShopRite', 'Wegmans', 'Stop & Shop', 'Acme'],
  'tuna steak': ['Ahi Tuna Co.', 'SeaBear', 'Ocean Beauty', 'Gorton\'s', 'ShopRite', 'Wegmans', 'Acme'],
  'cod': ['Gorton\'s', 'High Liner', 'SeaBear', 'Captain\'s Choice', 'ShopRite', 'Wegmans', 'Stop & Shop'],

  // ─── PANTRY ───────────────────────────────────────────────────────────────

  'pasta': ['Barilla', 'De Cecco', 'Ronzoni', 'Banza', 'Garofalo', 'ShopRite', 'Wegmans'],
  'rice': ['Mahatma', 'Uncle Ben\'s (Ben\'s Original)', 'Lundberg', 'Goya', 'Carolina', 'ShopRite', 'Wegmans'],
  'bread': ['Arnold', 'Pepperidge Farm', 'Martin\'s', 'Dave\'s Killer Bread', 'Nature\'s Own', 'ShopRite', 'Wegmans'],
  'olive oil': ['Colavita', 'California Olive Ranch', 'Filippo Berio', 'Kirkland Signature', 'Pompeian', 'ShopRite', 'Wegmans'],
  'vegetable oil': ['Crisco', 'Wesson', 'Mazola', 'Spectrum', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'flour': ['Gold Medal', 'King Arthur', 'Pillsbury', 'Bob\'s Red Mill', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'sugar': ['Domino', 'C&H', 'Imperial', 'Bob\'s Red Mill', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'salt': ['Morton', 'Diamond Crystal', 'Himalayan Pink', 'Maldon', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'black pepper': ['McCormick', 'Spice Islands', 'Badia', 'Simply Organic', 'Tone\'s', 'ShopRite', 'Wegmans'],
  'chicken broth': ['Swanson', 'Pacific Foods', 'Kitchen Basics', 'College Inn', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'canned tomatoes': ['Hunt\'s', 'Muir Glen', 'San Marzano (Cento)', 'Tuttorosso', 'Pomi', 'ShopRite', 'Wegmans'],
  'tomato sauce': ['Rao\'s', 'Prego', 'Classico', 'Muir Glen', 'Victoria', 'ShopRite', 'Wegmans'],
  'peanut butter': ['Jif', 'Skippy', 'Justin\'s', 'Teddie', 'Smucker\'s Natural', 'ShopRite', 'Wegmans'],
  'jelly': ['Smucker\'s', 'Welch\'s', 'Bonne Maman', 'Polaner', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'honey': ['Nature Nate\'s', 'Sue Bee', 'Local Hive', 'Wholesome', 'Mike\'s Hot Honey', 'ShopRite', 'Wegmans'],
  'maple syrup': ['Coombs Family Farms', 'Maple Grove Farms', 'Butternut Mountain Farm', 'Anderson\'s', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'oatmeal': ['Quaker', 'Bob\'s Red Mill', 'Nature\'s Path', 'McCann\'s', 'Kodiak Cakes', 'ShopRite', 'Wegmans'],
  'cereal': ['Kellogg\'s', 'General Mills', 'Post', 'Nature\'s Path', 'Cascadian Farm', 'ShopRite', 'Wegmans'],
  'granola': ['Kind', 'Purely Elizabeth', 'Bear Naked', 'Nature Valley', 'Granola Guru', 'ShopRite', 'Wegmans'],
  'coffee': ['Folgers', 'Maxwell House', 'Dunkin\'', 'Starbucks', 'Eight O\'Clock', 'ShopRite', 'Wegmans'],
  'tea': ['Lipton', 'Bigelow', 'Celestial Seasonings', 'Tetley', 'Twinings', 'ShopRite', 'Wegmans'],
  'sparkling water': ['LaCroix', 'Polar', 'Perrier', 'San Pellegrino', 'Bubly', 'ShopRite', 'Wegmans'],
  'soda': ['Coca-Cola', 'Pepsi', 'Dr Pepper', 'Sprite', 'Canada Dry', 'ShopRite', 'Wegmans'],
  'orange juice': ['Tropicana', 'Simply Orange', 'Minute Maid', 'Florida\'s Natural', 'Natalie\'s', 'ShopRite', 'Wegmans'],
  'apple juice': ['Mott\'s', 'Martinelli\'s', 'Tropicana', 'Minute Maid', 'ShopRite', 'Wegmans', 'Stop & Shop'],

  // ─── SNACKS ───────────────────────────────────────────────────────────────

  'potato chips': ['Utz', 'Wise', 'Lay\'s', 'Ruffles', 'Cape Cod', 'Kettle Brand', 'ShopRite'],
  'tortilla chips': ['Tostitos', 'Mission', 'On The Border', 'Late July', 'Garden of Eatin\'', 'ShopRite', 'Wegmans'],
  'crackers': ['Ritz', 'Triscuit', 'Wheat Thins', 'Pepperidge Farm', 'Late July', 'ShopRite', 'Wegmans'],
  'cookies': ['Pepperidge Farm', 'Oreo', 'Chips Ahoy', 'Tate\'s Bake Shop', 'Nabisco', 'ShopRite', 'Wegmans'],
  'granola bars': ['Kind', 'Clif Bar', 'Nature Valley', 'RXBAR', 'Larabar', 'ShopRite', 'Wegmans'],
  'popcorn': ['Orville Redenbacher', 'Act II', 'SkinnyPop', 'Boom Chicka Pop', 'Smartfood', 'ShopRite', 'Wegmans'],
  'pretzels': ['Utz', 'Snyder\'s of Hanover', 'Rold Gold', 'Quinn', 'Martin\'s', 'ShopRite', 'Wegmans'],
  'nuts': ['Planters', 'Blue Diamond', 'Fisher', 'Wonderful Pistachios', 'Emerald', 'ShopRite', 'Wegmans'],
  'trail mix': ['Planters', 'Emerald', 'Good Sense', 'Nature\'s Garden', 'KIND', 'ShopRite', 'Wegmans'],
  'salsa': ['Pace', 'Tostitos', 'Newman\'s Own', 'Green Mountain Gringo', 'Frontera', 'ShopRite', 'Wegmans'],
  'hummus': ['Sabra', 'Cedar\'s', 'Boar\'s Head', 'Hope Foods', 'Ithaca', 'ShopRite', 'Wegmans'],
  'guacamole': ['Sabra', 'Wholly Guacamole', 'Hope Foods', 'Good Foods', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'cheese dip': ['Tostitos', 'Fritos', 'Velveeta', 'Heluva Good', 'Utz', 'ShopRite', 'Wegmans'],
  'pita chips': ['Stacy\'s', 'Athenos', 'Sabra', 'Cava', 'ShopRite', 'Wegmans', 'Stop & Shop'],

  // ─── FROZEN ───────────────────────────────────────────────────────────────

  'frozen pancakes': ['Kodiak Cakes', 'Eggo', 'Pillsbury', 'Van\'s', 'Birch Benders', 'ShopRite', 'Wegmans'],
  'frozen pizza': ['DiGiorno', 'Amy\'s', 'Newman\'s Own', 'Screamin\' Sicilian', 'Freschetta', 'ShopRite', 'Wegmans'],
  'frozen meals': ['Amy\'s', 'Healthy Choice', 'Lean Cuisine', 'Stouffer\'s', 'Birds Eye', 'ShopRite', 'Wegmans'],
  'frozen fries': ['Ore-Ida', 'Alexia', 'McCain', 'Farm Rich', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'frozen meatballs': ['Aidells', 'Cooked Perfect', 'Carando', 'ShopRite', 'Wegmans', 'Stop & Shop', 'Acme'],
  'frozen vegetables': ['Birds Eye', 'Green Giant', 'Cascadian Farm', 'Alexia', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'ice cream': ['Häagen-Dazs', 'Breyers', 'Turkey Hill', 'Edy\'s (Dreyer\'s)', 'Ben & Jerry\'s', 'ShopRite', 'Wegmans'],
  'frozen burritos': ['Amy\'s', 'El Monterey', 'Trader Joe\'s', 'Don Miguel', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'frozen waffles': ['Eggo', 'Birch Benders', 'Van\'s', 'Nature\'s Path', 'Kodiak Cakes', 'ShopRite', 'Wegmans'],
  'chicken nuggets': ['Tyson', 'Perdue', 'Bell & Evans', 'Just Bare', 'Applegate', 'ShopRite', 'Wegmans'],
  'fish sticks': ['Gorton\'s', 'Van de Kamp\'s', 'Trident', 'High Liner', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'frozen fruit': ['Dole', 'Wyman\'s', 'Cascadian Farm', 'Earthbound Farm', 'ShopRite', 'Wegmans', 'Stop & Shop'],

  // ─── HOUSEHOLD ────────────────────────────────────────────────────────────

  'paper towels': ['Bounty', 'Viva', 'Brawny', 'Scott', 'Marcal', 'ShopRite', 'Wegmans'],
  'toilet paper': ['Charmin', 'Cottonelle', 'Scott', 'Angel Soft', 'Seventh Generation', 'ShopRite', 'Wegmans'],
  'dish soap': ['Dawn', 'Palmolive', 'Method', 'Seventh Generation', 'Mrs. Meyer\'s', 'ShopRite', 'Wegmans'],
  'laundry detergent': ['Tide', 'Gain', 'Arm & Hammer', 'Persil', 'All', 'ShopRite', 'Wegmans'],
  'trash bags': ['Hefty', 'Glad', 'Husky', 'Great Value', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'aluminum foil': ['Reynolds Wrap', 'Kirkland Signature', 'Solux', 'ShopRite', 'Wegmans', 'Stop & Shop', 'Acme'],
  'plastic wrap': ['Glad ClingWrap', 'Reynolds', 'Stretch-Tite', 'Saran', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'zip lock bags': ['Ziploc', 'Glad', 'Hefty', 'Solux', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'sponges': ['Scotch-Brite', 'O-Cedar', 'Spontex', 'Dawn', 'ShopRite', 'Wegmans', 'Stop & Shop'],
  'cleaning spray': ['Lysol', 'Method', 'Mrs. Meyer\'s', 'Clorox', 'Seventh Generation', 'ShopRite', 'Wegmans'],

  // ─── PERSONAL CARE ────────────────────────────────────────────────────────

  'shampoo': ['Pantene', 'Dove', 'TRESemmé', 'OGX', 'Head & Shoulders', 'Suave', 'Herbal Essences'],
  'conditioner': ['Pantene', 'Dove', 'TRESemmé', 'OGX', 'Herbal Essences', 'Suave', 'Garnier Fructis'],
  'body wash': ['Dove', 'Olay', 'Irish Spring', 'Old Spice', 'Aveeno', 'Nivea', 'Method'],
  'toothpaste': ['Colgate', 'Crest', 'Sensodyne', 'Arm & Hammer', 'Tom\'s of Maine', 'Aquafresh', 'Hello'],
  'deodorant': ['Degree', 'Secret', 'Dove', 'Old Spice', 'Arm & Hammer', 'Native', 'Speed Stick'],
  'razors': ['Gillette', 'Schick', 'BIC', 'Billie', 'Dorco', 'Harry\'s', 'Eos'],
  'hand soap': ['Softsoap', 'Method', 'Mrs. Meyer\'s', 'Dial', 'Seventh Generation', 'Dove', 'GOJO'],
  'face wash': ['Cetaphil', 'CeraVe', 'Neutrogena', 'Olay', 'Aveeno', 'Dove', 'Simple'],
  'lotion': ['Aveeno', 'CeraVe', 'Lubriderm', 'Eucerin', 'Vaseline', 'Jergens', 'Cetaphil'],
  'dental floss': ['Oral-B', 'Colgate', 'Listerine', 'GUM', 'Plackers', 'Tom\'s of Maine', 'Cocofloss'],

    };

    const key = itemName.toLowerCase().trim();

    // Match strategy: exact → key contains input → input contains key (no single-word cross-matches)
    let brands = brandOptions[key];
    if (!brands) {
      // Try: library key contains the full search term
      const exactContains = Object.keys(brandOptions).find(k => k.includes(key));
      if (exactContains) brands = brandOptions[exactContains];
    }
    if (!brands) {
      // Try: search term contains the full library key (e.g. "whole milk" → "milk")
      const inputContains = Object.keys(brandOptions).find(k => key.includes(k) && k.length > 4);
      if (inputContains) brands = brandOptions[inputContains];
    }
    brands = brands || ['ShopRite', 'Wegmans', 'Stop & Shop', 'Acme Markets', 'Organic Valley'];

    // Surface allergy-friendly brands at the top based on household dietary needs
    const dietary = this.household?.dietary || [];
    const safeBrands = new Set();
    dietary.forEach(d => {
      (this.allergyFriendlyBrands[d] || []).forEach(b => safeBrands.add(b));
    });
    if (safeBrands.size > 0) {
      const safeInList = brands.filter(b => safeBrands.has(b));
      const rest = brands.filter(b => !safeBrands.has(b));
      brands = [...safeInList, ...rest];
    }

    // Check if this item has flavor options
    const flavors = this.flavorOptions[key] || (() => {
      const match = Object.keys(this.flavorOptions).find(k => k.includes(key) || key.includes(k));
      return match ? this.flavorOptions[match] : null;
    })();

    const modal = document.createElement('div');
    modal.className = 'store-modal-overlay brand-picker-overlay';
    modal.innerHTML = `
      <div class="store-modal store-modal-wide">
        <div class="store-modal-header">
          <div>
            <h3>Preferences for ${itemName}</h3>
            <p class="store-modal-sub">Saved to your household — remembered every run</p>
          </div>
          <button class="modal-close-btn" id="brand-modal-close">✕</button>
        </div>
        <div id="brand-step">
          <p class="picker-step-label">Step 1 of ${flavors ? 2 : 1} — Brand</p>
          <div class="brand-options-grid">
            <button class="brand-option-btn ${!currentBrand || currentBrand === 'any' ? 'brand-option-selected' : ''}" data-brand="any">
              <span class="brand-option-name">Any brand</span>
              <span class="brand-option-sub">Lowest available price</span>
            </button>
            ${brands.map(b => `
              <button class="brand-option-btn ${currentBrand === b ? 'brand-option-selected' : ''} ${safeBrands.has(b) ? 'brand-option-safe' : ''}" data-brand="${b}">
                <span class="brand-option-name">${b}</span>
                ${safeBrands.has(b) ? `<span class="brand-safe-badge">✓ ${dietary.filter(d => (this.allergyFriendlyBrands[d]||[]).includes(b)).join(', ')}</span>` : ''}
              </button>
            `).join('')}
          </div>
        </div>
        <div id="flavor-step" class="hidden">
          <p class="picker-step-label">Step 2 of 2 — Flavor / Type</p>
          <div class="brand-options-grid" id="flavor-grid"></div>
        </div>
        <div class="store-modal-footer">
          <button class="btn-ghost" id="brand-modal-cancel">Cancel</button>
          <button class="btn-ghost hidden" id="brand-back-btn">← Back</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('brand-modal-close').addEventListener('click', close);
    document.getElementById('brand-modal-cancel').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    let selectedBrand = currentBrand || null;

    const savePref = async (brand, flavor) => {
      if (!this.household.brand_preferences) this.household.brand_preferences = {};
      if (!brand || brand === 'any') {
        delete this.household.brand_preferences[key];
      } else {
        this.household.brand_preferences[key] = flavor ? { brand, flavor } : brand;
      }
      await DB.saveBrandPreferences(this.household.id, this.household.brand_preferences);

      // Update tag in DOM
      const displayLabel = !brand || brand === 'any' ? 'Any brand' : (flavor ? brand + ' · ' + flavor : brand);
      document.querySelectorAll(`.brand-tag[data-item="${itemName}"]`).forEach(tag => {
        tag.textContent = displayLabel + ' ▾';
        tag.className = brand && brand !== 'any' ? 'brand-tag brand-tag-set' : 'brand-tag brand-tag-any';
        tag.dataset.brand = brand || '';
        tag.dataset.flavor = flavor || '';
      });
    };

    // Brand selection
    modal.querySelectorAll('#brand-step .brand-option-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        selectedBrand = btn.dataset.brand;

        if (!flavors || selectedBrand === 'any') {
          // No flavor step needed
          close();
          await savePref(selectedBrand, null);
          return;
        }

        // Show flavor step
        document.getElementById('brand-step').classList.add('hidden');
        document.getElementById('flavor-step').classList.remove('hidden');
        document.getElementById('brand-back-btn').classList.remove('hidden');
        document.getElementById('brand-modal-cancel').classList.add('hidden');

        const flavorGrid = document.getElementById('flavor-grid');
        const curFlavor = currentFlavor || '';
        flavorGrid.innerHTML = [
          `<button class="brand-option-btn ${!curFlavor ? 'brand-option-selected' : ''}" data-flavor="">
            <span class="brand-option-name">Any flavor</span>
            <span class="brand-option-sub">No preference</span>
          </button>`,
          ...flavors.map(f => `
            <button class="brand-option-btn ${curFlavor === f ? 'brand-option-selected' : ''}" data-flavor="${f}">
              <span class="brand-option-name">${f}</span>
            </button>`)
        ].join('');

        flavorGrid.querySelectorAll('.brand-option-btn').forEach(fb => {
          fb.addEventListener('click', async () => {
            const flavor = fb.dataset.flavor || null;
            close();
            await savePref(selectedBrand, flavor);
          });
        });
      });
    });

    // Back button
    document.getElementById('brand-back-btn').addEventListener('click', () => {
      document.getElementById('flavor-step').classList.add('hidden');
      document.getElementById('brand-step').classList.remove('hidden');
      document.getElementById('brand-back-btn').classList.add('hidden');
      document.getElementById('brand-modal-cancel').classList.remove('hidden');
    });
  },

  bindActions() {
    document.getElementById('add-item-btn').addEventListener('click', () => this.addItem());
    document.getElementById('item-name').addEventListener('keydown', e => { if (e.key === 'Enter') this.addItem(); });
    document.getElementById('get-basket-btn').addEventListener('click', () => this.runDecision());

    // Scan receipt
    document.getElementById('scan-btn').addEventListener('click', () => {
      document.getElementById('scan-panel').classList.remove('hidden');
      document.getElementById('import-panel').classList.add('hidden');
    });
    document.getElementById('scan-cancel').addEventListener('click', () => {
      document.getElementById('scan-panel').classList.add('hidden');
      this.resetScanPanel();
    });
    document.getElementById('scan-choose').addEventListener('click', () => {
      document.getElementById('receipt-file').click();
    });
    document.getElementById('scan-upload-area').addEventListener('click', (e) => {
      if (e.target.id === 'scan-upload-area' || e.target.id === 'scan-placeholder' ||
          e.target.classList.contains('scan-label') || e.target.classList.contains('scan-sub') ||
          e.target.classList.contains('scan-icon')) {
        document.getElementById('receipt-file').click();
      }
    });
    document.getElementById('receipt-file').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const preview = document.getElementById('scan-preview');
        const placeholder = document.getElementById('scan-placeholder');
        preview.src = ev.target.result;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        document.getElementById('scan-run').classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    });
    document.getElementById('scan-run').addEventListener('click', () => this.runReceiptScan());

    document.getElementById('import-btn').addEventListener('click', () => {
      document.getElementById('import-panel').classList.remove('hidden');
      document.getElementById('scan-panel').classList.add('hidden');
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

    // Brand tag clicks
    document.addEventListener('click', e => {
      const tag = e.target.closest('.brand-tag');
      if (!tag) return;
      this.openBrandPicker(tag.dataset.item, tag.dataset.brand || '', tag.dataset.flavor || '');
    }, { capture: false });

    // Quantity stepper — + and − buttons on every item row
    document.addEventListener('click', e => {
      const btn = e.target.closest('.qty-btn');
      if (!btn) return;
      const id = btn.dataset.id;
      const isSaved = btn.dataset.saved === 'true';
      const isInc = btn.classList.contains('qty-inc');

      if (isSaved) {
        // Saved item: update in DB
        const item = this.items.find(i => String(i.id) === String(id));
        if (!item) return;
        const newQty = Math.max(1, (item.quantity || 1) + (isInc ? 1 : -1));
        item.quantity = newQty;
        const valEl = document.getElementById('qty-' + id);
        if (valEl) valEl.textContent = newQty;
        DB.updatePantryItem(id, { quantity: newQty }).catch(() => {});
      } else {
        // New (unsaved) item
        const item = this.newItems.find(i => String(i.tempId) === String(id));
        if (!item) return;
        const newQty = Math.max(1, (item.quantity || 1) + (isInc ? 1 : -1));
        item.quantity = newQty;
        const valEl = document.getElementById('qty-' + id);
        if (valEl) valEl.textContent = newQty;
      }
    });

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

  resetScanPanel() {
    const preview = document.getElementById('scan-preview');
    const placeholder = document.getElementById('scan-placeholder');
    const runBtn = document.getElementById('scan-run');
    const status = document.getElementById('scan-status');
    const fileInput = document.getElementById('receipt-file');
    if (preview) { preview.src = ''; preview.classList.add('hidden'); }
    if (placeholder) placeholder.classList.remove('hidden');
    if (runBtn) runBtn.classList.add('hidden');
    if (status) { status.className = 'import-status hidden'; status.textContent = ''; }
    if (fileInput) fileInput.value = '';
  },

  async runReceiptScan() {
    const fileInput = document.getElementById('receipt-file');
    const file = fileInput?.files?.[0];
    if (!file) return;

    const btn = document.getElementById('scan-run');
    const status = document.getElementById('scan-status');

    btn.disabled = true;
    btn.textContent = 'Reading receipt...';
    status.className = 'import-status import-status-loading';
    status.textContent = '🔍 Analyzing your receipt with AI...';
    status.classList.remove('hidden');

    try {
      // Convert image to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // Strip the data URL prefix to get pure base64
          const result = reader.result;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const mediaType = file.type || 'image/jpeg';

      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not read receipt');
      }

      // Add all items to the pantry list
      let added = 0;
      data.items.forEach(item => {
        if (!item.name) return;
        const already = this.items.some(i => i.name.toLowerCase() === item.name.toLowerCase())
          || this.newItems.some(i => i.name.toLowerCase() === item.name.toLowerCase());
        if (!already) {
          this.addItemDirect(item.name, item.category || '', item.quantity || 1);
          added++;
        }
      });

      const storeMsg = data.store ? ` from ${data.store}` : '';
      const priceMsg = data.items.filter(i => i.price).length > 0 ? ' · prices saved to our database' : '';

      status.className = 'import-status import-status-success';
      status.innerHTML = `✓ Added ${added} item${added !== 1 ? 's' : ''}${storeMsg}${priceMsg}`;

      btn.disabled = false;
      btn.textContent = 'Read receipt →';

      // Auto-close after a moment if all went well
      if (added > 0) {
        setTimeout(() => {
          document.getElementById('scan-panel').classList.add('hidden');
          this.resetScanPanel();
        }, 2500);
      }

    } catch (err) {
      status.className = 'import-status import-status-error';
      status.textContent = '❌ ' + (err.message || 'Could not read receipt. Try a clearer photo.');
      btn.disabled = false;
      btn.textContent = 'Read receipt →';
    }
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

      // Save new items in parallel (not sequential)
      await Promise.all(this.newItems.map(item =>
        DB.savePantryItem({ household_id: this.household.id, name: item.name, category: item.category, quantity: item.quantity })
          .catch(() => {}) // don't let a single save failure block the run
      ));

      // Filter out any receipt artifacts that may have slipped into saved items
      const artifactPattern = /adjustment|subtotal|loyalty|items found|special request|weight adjustment|replacement icon|final item price|original price|replaced item|^(canned goods|dry goods|dairy|produce|frozen|snacks|bakery|beverages|pantry|breakfast|international|meat|seafood)$/i;
      const isValidItem = (name) => name && name.trim().length > 1 && !artifactPattern.test(name.trim()) && !/^[0-9]+(\.?[0-9]*)\s*(x|lb)/i.test(name.trim());

      const allItems = [
        ...this.items.filter(i => isValidItem(i.name)),
        ...this.newItems.filter(i => isValidItem(i.name)).map(i => ({ name: i.name, category: i.category, quantity: i.quantity }))
      ];

      // Run decision with a 20-second hard timeout
      const result = await Promise.race([
        DecisionEngine.run(allItems, this.household),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000))
      ]);

      // Save decision in background — don't block navigation
      DB.saveDecision({
        household_id: this.household.id,
        mode: this.household.default_mode || 'balanced',
        item_count: allItems.length,
        estimated_cost: result.balanced?.total || null,
        result_json: result,
      }).catch(() => {});

      Router.go('results', { result, household: this.household, items: allItems });
    } catch (err) {
      console.error('Decision error:', err.message);
      btn.disabled = false;
      btn.textContent = 'Get my basket →';
      const errDiv = document.createElement('div');
      errDiv.className = 'basket-error';
      errDiv.textContent = err.message === 'timeout'
        ? '⚠️ Analysis is taking too long — please try again.'
        : '⚠️ Something went wrong. Please try again.';
      document.querySelector('.page-header')?.appendChild(errDiv);
      setTimeout(() => errDiv.remove(), 4000);
    }
  }
};
