// PantryOS — Main app entry point

// Clear any stale Supabase sessions on load
// (handles key format change from sb_publishable to JWT)
(function clearStaleSession() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = JSON.parse(localStorage.getItem(key));
        // If access_token doesn't look like a JWT (eyJ...), clear it
        if (val?.access_token && !val.access_token.startsWith('eyJ')) {
          localStorage.removeItem(key);
          console.log('Cleared stale session token');
        }
      }
    }
  } catch(e) {}
})();

async function init() {
  Auth.onAuthChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (session?.user) {
        try {
          const { data: household, error } = await DB.getHousehold(session.user.id);
          if (error) {
            console.warn('getHousehold error:', error.message);
            // Session may be stale — force re-auth
            await Auth.signOut();
            Router.go('auth');
            return;
          }
          Router.go(household ? 'dashboard' : 'onboarding');
        } catch(e) {
          console.error('Init error:', e);
          Router.go('auth');
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
