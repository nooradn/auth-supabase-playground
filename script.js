// ══════════════════════════════════════════════════════════
//  INITIALIZATION — Create Supabase Client
// ══════════════════════════════════════════════════════════
//
//  SUPABASE_URL    = Your project endpoint (where your database & auth
//                    server run, hosted by Supabase)
//  SUPABASE_ANON   = Anonymous key. Safe to publish & expose in
//                    the frontend. This is not a secret (unlike the
//                    service_role key which MUST NEVER be leaked).
//
//  Why use `supabase.createClient`?
//  - The `supabase` object comes from the CDN script tag in index.html.
//    The CDN declares a global `supabase` object (names would collide
//    if we declared `const supabase` ourselves).
//  - We consume the global object to instantiate the client and store
//    it in `client`.
//  - Credentials are dynamically loaded from `.env` via `loadEnv()`.
//
let SUPABASE_URL  = '';
let SUPABASE_ANON = '';
let client = null;

// Helper function to parse .env file on static servers
async function loadEnv() {
  if (window.ENV && (window.ENV.SUPABASE_URL || window.ENV.SUPABASE_ANON)) {
    return window.ENV;
  }

  try {
    const res = await fetch('.env');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to access .env file.`);
    }
    const text = await res.text();
    const env = {};
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx !== -1) {
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
    return env;
  } catch (err) {
    console.warn('Failed to read .env:', err);
    return null;
  }
}

// Check whether Supabase client is initialized and ready
function checkClient() {
  if (!client) {
    log('error', 'Supabase client is not ready. Ensure .env exists and the app is served via a web server (e.g., `pnpm dlx serve .` or `npx serve .`).');
    return false;
  }
  return true;
}

// Track log entries count (for badge count in header)
let logCount = 0;

// ══════════════════════════════════════════════════════════
//  LOGGING UTILITY — Render log entry to the left panel
// ══════════════════════════════════════════════════════════
//
//  This is an educational helper, not part of Supabase.
//  All auth operation results are rendered to `#logs` so you can
//  inspect what actually happens under the hood.
//
//  type:    log type → determines badge color (info/success/error/warn/action)
//  message: brief description of the event
//  data:    optional, any object → pretty-printed as JSON
//
function log(type, message, data) {
  const logsEl = document.getElementById('logs');
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  // Format local timestamp to display order of events
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });

  // If `data` is provided, pretty-print formatted JSON
  const dataBlock = data !== undefined ? `<pre>${JSON.stringify(data, null, 2)}</pre>` : '';

  entry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-type ${type}">${type}</span>
    ${message}
    ${dataBlock}
  `;

  // Prepend: NEWEST log appears at the TOP
  logsEl.prepend(entry);
  logCount++;
  document.getElementById('logCount').textContent = logCount;
}

function clearLogs() {
  document.getElementById('logs').innerHTML = '';
  logCount = 0;
  document.getElementById('logCount').textContent = 0;
}

// ══════════════════════════════════════════════════════════
//  SESSION vs USER — Understanding the core difference
// ══════════════════════════════════════════════════════════
//
//  Supabase uses JWTs (JSON Web Tokens) for authentication.
//
//  SESSION = Access token package ("admission ticket").
//    - Automatically stored in browser localStorage (not in code).
//    - Has an expiry (expires_at) and is automatically refreshed
//      by the SDK when valid.
//    - An active session means the client has a usable JWT.
//
//  USER = Profile and identity data of the signed-in user (id, email, metadata).
//    Cached from JWT; can be verified from server via getUser().
//
//  refreshStatus() is called after most auth operations to update
//  the "Authenticated / No Session" badge + user card on the right panel.
//
async function refreshStatus() {
  if (!client) return;
  const badge = document.getElementById('statusBadge');
  const card = document.getElementById('userCard');

  // getSession() = Checks localStorage: "Is there an active session?"
  // Supabase convention: results are wrapped in `{ data, error }`,
  // never thrown as raw exceptions. Always inspect error first.
  const { data: { session } } = await client.auth.getSession();

  if (session) {
    badge.className = 'status authenticated';
    badge.textContent = 'Authenticated';
    card.style.display = 'block';
    document.getElementById('userId').textContent = session.user.id;
    document.getElementById('userEmail').textContent = session.user.email || '(no email)';
  } else {
    badge.className = 'status unauthenticated';
    badge.textContent = 'No Session';
    card.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════════════
//  AUTH ACTIONS
// ══════════════════════════════════════════════════════════

// ── SIGN UP ─────────────────────────────────────────────
// Creates a new user in Supabase Auth.
// If "Confirm email" is enabled in your Supabase dashboard:
//   - User is created, but cannot log in until they confirm via email.
//   - `data.session` will be null.
// If "Confirm email" is disabled:
//   - `data.session` is returned immediately and user is logged in.
async function signUp() {
  if (!checkClient()) return;
  // Read form inputs and trim email; password is NOT trimmed
  // because spaces inside passwords are valid.
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  log('action', `signUp("${email}")`);

  // All auth methods are ASYNC → use `await`.
  // While awaiting, UI is non-blocking; HTTP request is dispatched,
  // returning { data, error }.
  const { data, error } = await client.auth.signUp({ email, password });

  if (error) {
    log('error', error.message, error);
  } else {
    log('success', 'signUp — check email for confirmation', data);
    // data.session is only populated when email confirmation is disabled
    if (data.session) {
      log('info', 'User auto-signed-in (email confirmation may be disabled)');
    }
  }
  refreshStatus();
}

// ── SIGN IN (email + password) ──────────────────────────
// Classic authentication. On success, Supabase automatically saves
// access + refresh tokens in localStorage, keeping session active until signOut / expiration.
async function signIn() {
  if (!checkClient()) return;
  const email = document.getElementById('signinEmail').value.trim();
  const password = document.getElementById('signinPassword').value;
  log('action', `signIn("${email}")`);

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    log('error', error.message, error);
  } else {
    // data.user = identity, data.session = token + expiration
    log('success', 'signIn success', { user: data.user, session: data.session });
  }
  refreshStatus();
}

// ── SIGN IN via MAGIC LINK / OTP ────────────────────────
// Supabase sends an email with a login link or code. Clicking the link
// redirects back to the app (`redirectTo`) with tokens in URL hash →
// Supabase detects and establishes session automatically.
// No session is created until user clicks the email link.
//
// NOTE: This flow requires running through a web server
// (e.g. http://localhost/...), not file:// — hence `pnpm dlx serve .`.
async function signInOtp() {
  if (!checkClient()) return;
  const email = document.getElementById('signinEmail').value.trim();
  log('action', `signInOtp("${email}") — magic link / OTP`);

  const { data, error } = await client.auth.signInWithOtp({ email });
  if (error) {
    log('error', error.message, error);
  } else {
    log('success', 'OTP sent — check your email', data);
  }
}

// ── GET SESSION ─────────────────────────────────────────
// Reads session from LOCALSTORAGE (without network request).
// Session vs User difference: this only inspects the local token (FAST),
// but does not guarantee the user is still valid on the server.
async function getSession() {
  if (!checkClient()) return;
  log('action', 'getSession()');
  const { data: { session }, error } = await client.auth.getSession();
  if (error) {
    log('error', error.message, error);
  } else if (session) {
    log('success', 'Active session found', session);
  } else {
    log('warn', 'No active session');
  }
}

// ── GET USER (verified) ─────────────────────────────────
// Requests user data directly FROM THE SERVER (database verification).
// Slower than getSession, but guaranteed trusted — if session was revoked
// by an admin or on another device, getUser() will fail even if localStorage has token.
async function getUser() {
  if (!checkClient()) return;
  log('action', 'getUser()');
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    log('error', error.message, error);
  } else if (user) {
    log('success', 'User info', user);
  } else {
    log('warn', 'No user');
  }
}

// ── RESET PASSWORD ──────────────────────────────────────
// Sends a password reset email. The link targets `redirectTo` (this page)
// with a one-time recovery token.
// On the redirect page, updatePassword() is called to persist the new password.
async function resetPassword() {
  if (!checkClient()) return;
  const email = document.getElementById('resetEmail').value.trim();
  log('action', `resetPassword("${email}")`);

  const { data, error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href,
  });
  if (error) {
    log('error', error.message, error);
  } else {
    log('success', 'Password reset email sent', data);
  }
}

// ── UPDATE PASSWORD (for logged in user) ─────────────────
// Changes password for currently authenticated user. Active session required.
// updateUser() can also update other fields (e.g. { email, data: { name } }).
async function updatePassword() {
  if (!checkClient()) return;
  const newPassword = document.getElementById('newPassword').value;
  log('action', 'updatePassword()');

  const { data, error } = await client.auth.updateUser({ password: newPassword });
  if (error) {
    log('error', error.message, error);
  } else {
    log('success', 'Password updated', data);
  }
}

// ── SIGN OUT ────────────────────────────────────────────
// Revokes refresh token on server + clears localStorage.
// Subsequent requests requiring authentication will return 401.
async function signOut() {
  if (!checkClient()) return;
  log('action', 'signOut()');
  const { error } = await client.auth.signOut();
  if (error) {
    log('error', error.message, error);
  } else {
    log('success', 'Signed out');
  }
  refreshStatus();
}

// ══════════════════════════════════════════════════════════
//  INIT — Initialize client from .env and run on load
// ══════════════════════════════════════════════════════════
async function init() {
  const env = await loadEnv();
  if (!env) {
    log('error', 'Failed to load .env! When opening via file://, run a local web server such as `pnpm dlx serve .` or `npx serve .`. Ensure .env file exists.');
    return;
  }

  SUPABASE_URL = env.SUPABASE_URL || '';
  SUPABASE_ANON = env.SUPABASE_ANON || env.SUPABASE_ANON_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    log('error', 'SUPABASE_URL or SUPABASE_ANON is missing in .env. Please check your .env file.');
    return;
  }

  client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  // ══════════════════════════════════════════════════════════
  //  AUTH STATE LISTENER — Subscribe to auth state events
  // ══════════════════════════════════════════════════════════
  //
  //  This is the most critical production pattern: instead of
  //  manually updating UI in every function, we register a callback
  //  and Supabase triggers it on every change:
  //  INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED,
  //  USER_UPDATED, PASSWORD_RECOVERY, etc.
  //
  client.auth.onAuthStateChange((event, session) => {
    log('info', `onAuthStateChange: ${event}`, session ? { user: session.user?.email, expires: session.expires_at } : null);
    refreshStatus();
  });

  log('info', 'Supabase client initialized');
  log('info', `URL: ${SUPABASE_URL}`);
  refreshStatus();
}

init();