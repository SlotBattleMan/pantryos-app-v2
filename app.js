// PantryOS — Main app entry point

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
