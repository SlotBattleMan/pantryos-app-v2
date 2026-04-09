// PantryOS — Main app entry point

async function loadRuntimeConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.openaiKey) {
        PANTRYOS_CONFIG.openaiKey = data.openaiKey;
      }
    }
  } catch (e) {
    // Running locally or without API route — mock mode is fine
  }
}

async function init() {
  // Load runtime config (OpenAI key from server env)
  await loadRuntimeConfig();

  // Listen for auth state changes
  Auth.onAuthChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (session?.user) {
        // Check if household exists
        const { data: household } = await DB.getHousehold(session.user.id);
        if (household) {
          Router.go('dashboard');
        } else {
          Router.go('onboarding');
        }
      } else {
        Router.go('auth');
      }
    } else if (event === 'SIGNED_OUT') {
      Router.go('auth');
    }
  });
}

init();
