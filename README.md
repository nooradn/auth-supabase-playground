# Supabase Auth Playground

A lightweight, zero-build interactive playground designed for learning, testing, and debugging **Supabase Authentication** flows with vanilla JavaScript, HTML, and CSS.

---

## Features

- **Email & Password Sign Up**: Create accounts with automatic detection of email confirmation requirements.
- **Email & Password Sign In**: Authenticate users and persist JWT sessions in `localStorage`.
- **Magic Link / OTP**: Passwordless sign-in via email with redirect token handling.
- **Session vs. User Inspection**:
  - `getSession()`: Instant client-side inspection of cached tokens in `localStorage`.
  - `getUser()`: Server-side verified fetch confirming current database credentials.
- **Password Recovery**: Send password reset links and update credentials for authenticated users.
- **Sign Out**: Revoke tokens on the server and purge local session state.
- **Live Event Logger**: Real-time inspectable log panel with colored tags, timestamps, and formatted JSON payloads.
- **Auth State Listener**: Demonstrates reactive UI updates powered by `client.auth.onAuthStateChange`.

---

## Project Structure

```text
auth-supabase-playground/
├── .env.example      # Template for environment configuration
├── .env              # Local environment credentials (ignored by git)
├── .gitignore        # Git ignore rules for env files and dependencies
├── index.html        # Semantic UI layout (logs and action panels)
├── script.js         # Supabase client setup, env parser, and auth actions
├── style.css         # Clean, monospace-inspired stylesheet
└── README.md         # Project documentation
```

---

## Getting Started

### 1. Prerequisites

- A [Supabase](https://supabase.com) account and project.
- A local web server (e.g., Node.js with `npx`, `pnpm`, or Python).

> [!NOTE]
> A local HTTP server is required because browser security rules prevent `fetch()` from reading `.env` under the `file://` protocol. Furthermore, Supabase OTP / Magic Link redirects require an HTTP origin (e.g., `http://localhost:3000`).

### 2. Configure Environment Variables

Copy the example file to `.env`:

```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase credentials:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON=your-anon-publishable-key-here
```

Both values can be found in your Supabase Dashboard under **Project Settings** &rarr; **API**.

### 3. Run Locally

Start any local static file server from the project root:

```bash
# Using Node.js / npx
npx serve .

# Or using pnpm
pnpm dlx serve .

# Or using Python
python -m http.server 3000
```

Open your browser and navigate to the local address (e.g., `http://localhost:3000` or `http://localhost:5000`).

---

## Core Auth Concepts Covered

### 1. Anon Key vs. Service Role Key
- **`SUPABASE_ANON`** (`anon` / `publishable`): Safe for client-side use in the browser. It respects Row Level Security (RLS) policies configured in Supabase.
- **`service_role`**: Bypasses all RLS policies. **Never** expose this key in client-side code.

### 2. Session vs. User
- **Session**: A JWT token bundle stored locally in `localStorage`. It contains the access token and expiration time. Fast to query, but does not confirm if the account has been disabled or revoked on the server.
- **User**: Directly fetched and validated by Supabase backend servers. Guarantees fresh, verified identity data.

### 3. Reactive State with `onAuthStateChange`
Instead of manually updating UI states across multiple asynchronous methods, register a single subscriber:

```javascript
client.auth.onAuthStateChange((event, session) => {
  // Automatically called on SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.
  refreshStatus();
});
```
