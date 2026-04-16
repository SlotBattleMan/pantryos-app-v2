// Supabase client — uses real localStorage for persistent sessions on Vercel
const { createClient } = supabase;
const sb = createClient(PANTRYOS_CONFIG.supabaseUrl, PANTRYOS_CONFIG.supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
});

const Auth = {
  async signUp(email, password, name) {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name } } });
    return { data, error };
  },
  async signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    return { data, error };
  },
  async signOut() { await sb.auth.signOut(); Router.go('auth'); },
  async getUser() { const { data: { user } } = await sb.auth.getUser(); return user; },
  onAuthChange(cb) { sb.auth.onAuthStateChange(cb); }
};

const DB = {
  async getHousehold(userId) {
    const { data, error } = await sb.from('households').select('*').eq('user_id', userId).single();
    // PGRST116 = no rows found — not an error, just a new user with no household yet
    if (error?.code === 'PGRST116') return { data: null, error: null };
    return { data, error };
  },
  async saveHousehold(userId, profile) {
    const { data, error } = await sb.from('households').upsert({ user_id: userId, ...profile, updated_at: new Date().toISOString() }).select().single();
    return { data, error };
  },
  async updatePantryItem(itemId, fields) {
    const { data, error } = await sb.from('pantry_items').update(fields).eq('id', itemId).select().single();
    return { data, error };
  },
  async saveBrandPreferences(householdId, brandPreferences) {
    const { data, error } = await sb.from('households').update({ brand_preferences: brandPreferences, updated_at: new Date().toISOString() }).eq('id', householdId).select().single();
    return { data, error };
  },
  async getPantryItems(householdId) {
    const { data, error } = await sb.from('pantry_items').select('*').eq('household_id', householdId).order('created_at', { ascending: false });
    return { data: data || [], error };
  },
  async savePantryItem(item) {
    // Use ignoreDuplicates to prevent duplicate names per household
    const { data, error } = await sb.from('pantry_items')
      .upsert(item, { onConflict: 'household_id,name', ignoreDuplicates: true })
      .select().single();
    return { data, error };
  },
  async deletePantryItem(id) {
    const { error } = await sb.from('pantry_items').delete().eq('id', id);
    return { error };
  },
  async saveDecision(decision) {
    const { data, error } = await sb.from('decisions').insert(decision).select().single();
    return { data, error };
  },
  async getRecentDecisions(householdId, limit = 5) {
    const { data, error } = await sb.from('decisions').select('*').eq('household_id', householdId).order('created_at', { ascending: false }).limit(limit);
    return { data: data || [], error };
  }
};
