// PantryOS — Main app entry point

async function init() {
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
