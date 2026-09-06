// ─── Init ──────────────────────────────────────────────
const SUPABASE_URL  = 'https://moekyeviywfdkvtcvqsu.supabase.co';
const SUPABASE_ANON = 'sb_publishable_vRr5qVC9K7DvrMem-ceEyQ_hjHd19-x';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let logCount = 0;

// ─── Logging ───────────────────────────────────────────
function log(type, message, data) {
  const logsEl = document.getElementById('logs');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const dataBlock = data !== undefined ? `<pre>${JSON.stringify(data, null, 2)}</pre>` : '';
  entry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-type ${type}">${type}</span>
    ${message}
    ${dataBlock}
  `;
  logsEl.prepend(entry);
  logCount++;
  document.getElementById('logCount').textContent = logCount;
}

function clearLogs() {
  document.getElementById('logs').innerHTML = '';
  logCount = 0;
  document.getElementById('logCount').textContent = 0;
}

// ─── Status Badge ──────────────────────────────────────
async function refreshStatus() {
  const badge = document.getElementById('statusBadge');
  const card = document.getElementById('userCard');
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

// ─── Auth Actions ──────────────────────────────────────
async function signUp() {
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  log('action', `signUp("${email}")`);

  const { data, error } = await client.auth.signUp({ email, password });
  if (error) {
    log('error', error.message, error);
  } else {
    log('success', 'signUp — check email for confirmation', data);
    if (data.session) {
      log('info', 'User auto-signed-in (email confirmation may be disabled)');
    }
  }
  refreshStatus();
}

async function signIn() {
  const email = document.getElementById('signinEmail').value.trim();
  const password = document.getElementById('signinPassword').value;
  log('action', `signIn("${email}")`);

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    log('error', error.message, error);
  } else {
    log('success', 'signIn success', { user: data.user, session: data.session });
  }
  refreshStatus();
}

async function signInOtp() {
  const email = document.getElementById('signinEmail').value.trim();
  log('action', `signInOtp("${email}") — magic link / OTP`);

  const { data, error } = await client.auth.signInWithOtp({ email });
  if (error) {
    log('error', error.message, error);
  } else {
    log('success', 'OTP sent — check your email', data);
  }
}

async function getSession() {
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

async function getUser() {
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

async function resetPassword() {
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

async function updatePassword() {
  const newPassword = document.getElementById('newPassword').value;
  log('action', 'updatePassword()');

  const { data, error } = await client.auth.updateUser({ password: newPassword });
  if (error) {
    log('error', error.message, error);
  } else {
    log('success', 'Password updated', data);
  }
}

async function signOut() {
  log('action', 'signOut()');
  const { error } = await client.auth.signOut();
  if (error) {
    log('error', error.message, error);
  } else {
    log('success', 'Signed out');
  }
  refreshStatus();
}

// ─── Auth State Listener ───────────────────────────────
client.auth.onAuthStateChange((event, session) => {
  log('info', `onAuthStateChange: ${event}`, session ? { user: session.user?.email, expires: session.expires_at } : null);
  refreshStatus();
});

// ─── Init ──────────────────────────────────────────────
log('info', 'Supabase client initialized');
log('info', `URL: ${SUPABASE_URL}`);
refreshStatus();