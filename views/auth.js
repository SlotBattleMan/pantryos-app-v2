const AuthView = {
  render() {
    document.getElementById('app').innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-logo">
            <span class="logo-mark">P</span>
            <span class="logo-text">PantryOS</span>
          </div>
          <p class="auth-tagline">Your household's buying decisions — handled.</p>

          <div class="auth-tabs">
            <button class="tab-btn active" data-tab="signin">Sign In</button>
            <button class="tab-btn" data-tab="signup">Create Account</button>
          </div>

          <div id="auth-signin-view">
            <form id="signin-form">
              <div class="form-group">
                <label>Email</label>
                <input type="email" id="signin-email" placeholder="you@example.com" autocomplete="email" required />
              </div>
              <div class="form-group">
                <label>Password</label>
                <input type="password" id="signin-password" placeholder="••••••••" autocomplete="current-password" required />
              </div>
              <div id="signin-error" class="auth-error hidden"></div>
              <button type="submit" class="btn-primary btn-full" id="signin-submit">Sign In</button>
            </form>
            <button class="forgot-link" id="forgot-btn">Forgot password?</button>
          </div>

          <div id="auth-signup-view" class="hidden">
            <form id="signup-form">
              <div class="form-group">
                <label>Full Name</label>
                <input type="text" id="signup-name" placeholder="Jane Smith" autocomplete="name" />
              </div>
              <div class="form-group">
                <label>Email</label>
                <input type="email" id="signup-email" placeholder="you@example.com" autocomplete="email" required />
              </div>
              <div class="form-group">
                <label>Password</label>
                <input type="password" id="signup-password" placeholder="Min. 8 characters" autocomplete="new-password" required />
              </div>
              <div id="signup-error" class="auth-error hidden"></div>
              <button type="submit" class="btn-primary btn-full" id="signup-submit">Create Account</button>
            </form>
          </div>

          <div id="auth-reset-view" class="hidden">
            <div class="reset-header">
              <button class="back-to-signin" id="back-to-signin">← Back to sign in</button>
              <h3>Reset your password</h3>
              <p class="step-desc">Enter your email and we'll send you a reset link.</p>
            </div>
            <form id="reset-form">
              <div class="form-group">
                <label>Email</label>
                <input type="email" id="reset-email" placeholder="you@example.com" autocomplete="email" required />
              </div>
              <div id="reset-msg" class="auth-error hidden"></div>
              <button type="submit" class="btn-primary btn-full" id="reset-submit">Send reset link</button>
            </form>
          </div>

          <p class="auth-footer">By continuing, you agree to PantryOS Terms of Service.</p>
        </div>
      </div>
    `;

    this.bindTabs();
    this.bindSignIn();
    this.bindSignUp();
    this.bindReset();
  },

  bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('auth-signin-view').classList.toggle('hidden', tab !== 'signin');
        document.getElementById('auth-signup-view').classList.toggle('hidden', tab !== 'signup');
        document.getElementById('auth-reset-view').classList.add('hidden');
      });
    });
  },

  bindSignIn() {
    document.getElementById('signin-form').addEventListener('submit', async e => {
      e.preventDefault();
      const errEl = document.getElementById('signin-error');
      const btn = document.getElementById('signin-submit');
      const email = document.getElementById('signin-email').value.trim();
      const password = document.getElementById('signin-password').value;

      btn.disabled = true;
      btn.textContent = 'Signing in...';
      errEl.classList.add('hidden');

      const { error } = await Auth.signIn(email, password);
      if (error) {
        errEl.textContent = error.message;
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });

    document.getElementById('forgot-btn').addEventListener('click', () => {
      document.getElementById('auth-signin-view').classList.add('hidden');
      document.getElementById('auth-reset-view').classList.remove('hidden');
      document.querySelectorAll('.auth-tabs').forEach(t => t.style.display = 'none');
    });
  },

  bindSignUp() {
    document.getElementById('signup-form').addEventListener('submit', async e => {
      e.preventDefault();
      const errEl = document.getElementById('signup-error');
      const btn = document.getElementById('signup-submit');
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const name = document.getElementById('signup-name').value.trim();

      if (password.length < 8) {
        errEl.textContent = 'Password must be at least 8 characters.';
        errEl.classList.remove('hidden');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Creating account...';
      errEl.classList.add('hidden');

      const { data, error } = await Auth.signUp(email, password, name);
      if (error) {
        errEl.textContent = error.message;
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Create Account';
        return;
      }

      if (data?.user && !data?.session) {
        errEl.style.color = 'var(--success)';
        errEl.textContent = '✓ Check your email to confirm your account, then sign in.';
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Create Account';
      }
    });
  },

  bindReset() {
    document.getElementById('back-to-signin').addEventListener('click', () => {
      document.getElementById('auth-reset-view').classList.add('hidden');
      document.getElementById('auth-signin-view').classList.remove('hidden');
      document.querySelectorAll('.auth-tabs').forEach(t => t.style.display = '');
    });

    document.getElementById('reset-form').addEventListener('submit', async e => {
      e.preventDefault();
      const msgEl = document.getElementById('reset-msg');
      const btn = document.getElementById('reset-submit');
      const email = document.getElementById('reset-email').value.trim();

      btn.disabled = true;
      btn.textContent = 'Sending...';
      msgEl.classList.add('hidden');

      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
      });

      if (error) {
        msgEl.style.color = 'var(--error)';
        msgEl.textContent = error.message;
      } else {
        msgEl.style.color = 'var(--success)';
        msgEl.textContent = '✓ Reset link sent! Check your inbox.';
      }
      msgEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Send reset link';
    });
  }
};
