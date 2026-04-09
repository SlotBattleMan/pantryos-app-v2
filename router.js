const Router = {
  currentView: null,
  routes: {
    'auth': () => AuthView.render(),
    'onboarding': () => OnboardingView.render(),
    'dashboard': () => DashboardView.render(),
    'pantry': () => PantryView.render(),
    'results': (params) => ResultsView.render(params),
    'settings': () => SettingsView.render(),
  },
  go(view, params = {}) {
    const app = document.getElementById('app');
    app.innerHTML = '';
    app.className = `view-${view}`;
    this.currentView = view;
    if (this.routes[view]) this.routes[view](params);
  }
};
