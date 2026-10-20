// ══════════════════════════════════════════════════════════
//  INITIALIZATION — bikin Supabase client
// ══════════════════════════════════════════════════════════
//
//  SUPABASE_URL    = endpoint project kamu (tempat data & auth
//                    server jalan, di-hosting oleh Supabase)
//  SUPABASE_ANON   = "anonymous" key. Publish key, AMAN dipakai
//                    di frontend. Bukan rahasia (beda dengan
//                    service_role key yang TIDAK boleh bocor).
//
//  Kenapa pake `supabase.createClient`?
//  - Variable `supabase` datang dari CDN (script di index.html).
//    CDN itu men-declare GLOBAL `supabase` (nama bentrok kalau kita
//    declare `const supabase` sendiri — itu error yang kamu pernah
//    alami).
//  - Kita cuma "baca" global itu untuk bikin client, hasilnya kita
//    simpan di variable `client` dengan nama sendiri.
//  - Kredensial dibaca dari file `.env` via `loadEnv()`.
//
let SUPABASE_URL  = '';
let SUPABASE_ANON = '';
let client = null;

// Fungsi helper untuk mem-parse file .env pada static server
async function loadEnv() {
  if (window.ENV && (window.ENV.SUPABASE_URL || window.ENV.SUPABASE_ANON)) {
    return window.ENV;
  }

  try {
    const res = await fetch('.env');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: File .env tidak dapat diakses.`);
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
    console.warn('Gagal membaca .env:', err);
    return null;
  }
}

// Cek apakah Supabase client sudah siap digunakan
function checkClient() {
  if (!client) {
    log('error', 'Supabase client belum siap. Pastikan file .env ada dan app dijalankan via web server (misal: `pnpm dlx serve .` atau `npx serve .`).');
    return false;
  }
  return true;
}

// Hitung jumlah log yang tampil (buat badge count di header)
let logCount = 0;

// ══════════════════════════════════════════════════════════
//  LOGGING UTILITY — render satu baris log ke panel kiri
// ══════════════════════════════════════════════════════════
//
//  Ini bantuan buat belajar, bukan bagian dari Supabase. Semua
//  hasil auth operation kita tampilkan di `#logs` biar kamu bisa
//  lihat apa yang sebenarnya terjadi.
//
//  type:   jenis log → menentukan warna label (info/success/error/warn/action)
//  message: teks singkat yang menjelaskan apa yang terjadi
//  data:   optional, object apa pun → dipretty-print sebagai JSON
//
function log(type, message, data) {
  const logsEl = document.getElementById('logs');
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  // Format waktu lokal supaya tiap log keliatan urutan waktunya
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });

  // Kalau `data` dikasih, render jadi <pre> JSON yang rapi
  const dataBlock = data !== undefined ? `<pre>${JSON.stringify(data, null, 2)}</pre>` : '';

  entry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-type ${type}">${type}</span>
    ${message}
    ${dataBlock}
  `;

  // prepend (bukan append): log TERBARU di ATAS
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
//  SESSION vs USER — dua konsep yang harus dipahamin bedanya
// ══════════════════════════════════════════════════════════
//
//  Supabase pakai JWT (JSON Web Token) untuk auth.
//
//  SESSION = paket "kartu tanda masuk" berisi access token.
//    - Tersimpan otomatis di localStorage browser (bukan di kode).
//    - Punya masa berlaku (expires_at), dan di-refresh otomatis
//      sama library kalau masih valid.
//    - Sesi "ada" artinya client punya JWT yang bole dipakai.
//
//  USER = data identitas orang yang login (id, email, metadata).
//    Cache dari JWT; bisa di-refresh dari server via getUser().
//
//  refreshStatus() dipanggil setelah hampir semua operasi, buat
//  memperbarui badge "Authenticated / No Session" + kartu user di kanan.
//
async function refreshStatus() {
  if (!client) return;
  const badge = document.getElementById('statusBadge');
  const card = document.getElementById('userCard');

  // getSession() = Cek localStorage, "punya sesi aktif atau nggak?"
  // Catatan pola Supabase: hasil selalu dibungkus `{ data, error }`,
  // bukan `throw` exception. Kita selalu cek error-nya dulu.
  const { data: { session } } = await client.auth.getSession();

  // Destructuring: `data: { session }` artinya ambil `data.session`
  // dari object hasil, lalu simpan ke variable bernama `session`.

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
// Membuat user baru di Supabase Auth.
// Kalau "Confirm email" diaktifkan di dashboard → user dibuat
// TAPI belum bisa login sampai email dikonfirmasi lewat link yang
// dikirim Supabase. `data.session` bakal null dalam kasus itu.
// Kalau confirm email dimatikan → langsung `data.session` terisi
// dan user otomatis sudah login.
async function signUp() {
  if (!checkClient()) return;
  // Baca input form & trim (buang spasi di pinggir); password TIDAK
  // di-trim karena spasi dalam password itu valid.
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  log('action', `signUp("${email}")`);

  // Semua method auth itu ASYNC → makanya pakai `await`.
  // Saat `await`, UI nggak ngeblock; server dipanggil via HTTP,
  // kemudian hasilnya {data, error} dikembalikan.
  const { data, error } = await client.auth.signUp({ email, password });

  // Supabase TIDAK pakai try/catch untuk error normal — `error`
  // diisi object error kalau gagal, atau null/undefined kalau sukses.
  if (error) {
    log('error', error.message, error);
  } else {
    log('success', 'signUp — check email for confirmation', data);
    // data.session terisi HANYA kalau email confirmation NONAKTIF
    if (data.session) {
      log('info', 'User auto-signed-in (email confirmation may be disabled)');
    }
  }
  refreshStatus();
}

// ── SIGN IN (email + password) ──────────────────────────
// Login klasik. Sukses → Supabase menyimpan access+refresh token
// ke localStorage OTOMATIS, dan sesi aktif sampai signOut / expire.
async function signIn() {
  if (!checkClient()) return;
  const email = document.getElementById('signinEmail').value.trim();
  const password = document.getElementById('signinPassword').value;
  log('action', `signIn("${email}")`);

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    log('error', error.message, error);
  } else {
    // data.user = identitas, data.session = token + expiry
    log('success', 'signIn success', { user: data.user, session: data.session });
  }
  refreshStatus();
}

// ── SIGN IN via MAGIC LINK / OTP ────────────────────────
// Supabase kirim email berisi link/kode. User klik link → dibawa
// balik ke app (redirectTo) dengan token di URL → Supabase
// otomatis detect & set session. Tidak ada session yang dibuat
// sampai user benar-benar ngeklik link email.
//
//  CATATAN: auth flow pinter ini butuh halaman dibuka via server
//  (redirect ke http://localhost/...), bukan file:// — itu alasan
//  kenapa disarankan `pnpm dlx serve .`.
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
// Baca sesi yang ADA DI LOCALSTORAGE (tanpa internet).
// Di sinilah bedanya sesi vs user: ini cuma lihat token, CEPAT,
// tapi tidak menjamin user masih valid di server.
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
// Minta data user KE SERVER (verifikasi langsung dari database).
// Lebih lambat dari getSession, tapi hasilnya trusted —
// misalnya kunci kamu berpindah device / sesi dicabut admin,
// getUser() akan gagal walaupun localStorage masih ada token.
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
// Kirim email berisi link reset. Link mengarah ke `redirectTo`
// (halaman ini), disertai token once-use khusus.
// Di halaman tujuan, kamu biasanya panggil updatePassword() untuk
// beneran mengganti password.
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

// ── UPDATE PASSWORD (biasanya setelah klik link reset) ──
// Ganti password user yang sedang login. Wajib ada sesi aktif.
// updateUser() juga bisa dipakai buat update field lain
// (misal { email, data: { name } }) — bukan cuma password.
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
// Hapus refresh token dari server + bersihkan localStorage.
// Setelah ini, semua request yang butuh auth bakal 401.
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
//  AUTH STATE LISTENER — "subscribe" ke perubahan auth
// ══════════════════════════════════════════════════════════
//
//  Ini pattern yang paling penting di production: alih-alih
//  manual ngupdate UI di tiap fungsi, kita daftarkan callback
//  dan Supabase panggil callback ini setiap kali ada perubahan:
//  INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED,
//  USER_UPDATED, PASSWORD_RECOVERY, dll.
//
//  Cara makainya: satu tempat ini cukup — nggak perlu tiap fungsi
//  auth manggil refreshStatus manual, listener udah ngelakuin itu.
//
// ══════════════════════════════════════════════════════════
//  INIT — inisialisasi client dari .env dan jalankan sekali
// ══════════════════════════════════════════════════════════
async function init() {
  const env = await loadEnv();
  if (!env) {
    log('error', 'Gagal membaca .env! Jika membuka via file://, jalankan local web server seperti `pnpm dlx serve .` atau `npx serve .`. Pastikan file .env sudah dibuat.');
    return;
  }

  SUPABASE_URL = env.SUPABASE_URL || '';
  SUPABASE_ANON = env.SUPABASE_ANON || env.SUPABASE_ANON_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    log('error', 'SUPABASE_URL atau SUPABASE_ANON belum diisi di file .env. Silakan cek file .env kamu.');
    return;
  }

  client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  // Pasang listener auth state change
  client.auth.onAuthStateChange((event, session) => {
    log('info', `onAuthStateChange: ${event}`, session ? { user: session.user?.email, expires: session.expires_at } : null);
    refreshStatus();
  });

  log('info', 'Supabase client initialized');
  log('info', `URL: ${SUPABASE_URL}`);
  refreshStatus();
}

init();