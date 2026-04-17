// PantryOS — Main app entry point

async function init() {
  // Restore session from localStorage first — prevents blank/onboarding flash on reconnect
  const existingSession = await Auth.getSession().catch(() => null);

  // If we already have a valid session, route immediately without waiting
  if (existingSession?.user) {
    try {
      const { data: household } = await DB.getHousehold(existingSession.user.id);
      if (household) {
        Router.go('dashboard');
        return; // Don’t subscribe — already routed
      }
    } catch(e) {}
  }

  // Subscribe to auth state for sign in/out events
  Auth.onAuthChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
      if (session?.user) {
        try {
          const { data: household } = await DB.getHousehold(session.user.id);
          Router.go(household ? 'dashboard' : 'onboarding');
        } catch(e) {
          Router.go('auth');
        }
      }
    } else if (event === 'INITIAL_SESSION') {
      if (session?.user) {
        try {
          const { data: household } = await DB.getHousehold(session.user.id);
          Router.go(household ? 'dashboard' : 'onboarding');
        } catch(e) {
          Router.go('auth');
        }
      } else {
        Router.go('auth');
      }
    } else if (event === 'SIGNED_OUT') {
      Router.go('auth');
    } else if (event === 'TOKEN_REFRESHED') {
      // Session refreshed — no re-route needed, user is already on a page
    }
  });
}

init();
