"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser, authConfigured } from "../../lib/supabase";

// Sign in with email and password. Sign-ups are off in Supabase and the
// middleware only lets ALLOWED_EMAIL in, so this works as a lock screen.
// The home-screen app stays signed in until you sign out.
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("denied")) {
      setError("That email doesn't have access.");
    }
  }, []);

  if (!authConfigured) {
    return (
      <main className="screen run">
        <h1 className="run-title">Sign-in isn't set up yet</h1>
        <p className="muted">The Supabase keys are missing.</p>
      </main>
    );
  }

  const signIn = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setBusy(false);
      setError("That email and password didn't work. Check them and try again.");
    } else {
      window.location.replace("/");
    }
  };

  return (
    <main className="screen run login">
      <h1 className="run-title">Fifth Gear Fitness</h1>
      <form onSubmit={signIn}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="btn go big" disabled={busy || !email || !password}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
