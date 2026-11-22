"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser, authConfigured } from "../../lib/supabase";

// Two-step sign-in. Step 1: email and password. Step 2: a 6-digit code from
// an authenticator app (Apple Passwords, Google Authenticator, 1Password).
// The first time, step 2 sets up the authenticator instead.
// Sign-ups are off in Supabase and the middleware only lets ALLOWED_EMAIL in.
// The home-screen app stays signed in until you sign out.
export default function Login() {
  const [stage, setStage] = useState("loading"); // loading | password | setup | code
  const [error, setError] = useState("");

  const figureOutStage = async () => {
    const sb = supabaseBrowser();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return setStage("password");
    const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel === "aal2") return window.location.replace("/");
    setStage(data?.nextLevel === "aal2" ? "code" : "setup");
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("denied")) setError("That email doesn't have access.");
    if (!authConfigured) {
      // On localhost without keys, ?preview=setup or ?preview=code shows a
      // screen with sample data so it can be checked. Nothing is saved.
      const p = params.get("preview");
      if (process.env.NODE_ENV !== "production" && ["password", "setup", "code"].includes(p)) setStage(p);
      return;
    }
    figureOutStage().catch((e) => {
      setError(e.message);
      setStage("password");
    });
  }, []);

  const preview = !authConfigured;

  if (!authConfigured && stage === "loading") {
    return (
      <main className="screen run">
        <h1 className="run-title">Sign-in isn't set up yet</h1>
        <p className="muted">The Supabase keys are missing.</p>
      </main>
    );
  }

  return (
    <main className="screen run login">
      <h1 className="run-title">Fifth Gear Fitness</h1>
      {stage === "password" && <PasswordStep preview={preview} onDone={() => figureOutStage()} setError={setError} />}
      {stage === "setup" && <SetupStep preview={preview} setError={setError} />}
      {stage === "code" && <CodeStep preview={preview} setError={setError} />}
      {error && <p className="error">{error}</p>}
      {(stage === "setup" || stage === "code") && (
        <button
          className="link-btn plain"
          onClick={async () => {
            if (!preview) await supabaseBrowser().auth.signOut();
            window.location.replace("/login");
          }}
        >
          Sign out
        </button>
      )}
    </main>
  );
}

function PasswordStep({ preview, onDone, setError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (e) => {
    e.preventDefault();
    if (preview) return;
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setError("That email and password didn't work. Check them and try again.");
    } else {
      await onDone();
    }
  };

  return (
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
  );
}

// The 6-digit code box, shared by setup and sign-in.
function CodeForm({ label, busy, onSubmit }) {
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code);
      }}
    >
      <label className="field">
        <span>{label}</span>
        <input
          className="code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      <button className="btn go big" disabled={busy || code.length !== 6}>
        {busy ? "Checking..." : "Continue"}
      </button>
    </form>
  );
}

const BAD_CODE = "That code didn't work. Codes change every 30 seconds, so try the newest one.";

function CodeStep({ preview, setError }) {
  const [busy, setBusy] = useState(false);

  const verify = async (code) => {
    if (preview) return;
    setBusy(true);
    setError("");
    const sb = supabaseBrowser();
    const { data } = await sb.auth.mfa.listFactors();
    const factor = data?.totp?.[0];
    if (!factor) {
      window.location.replace("/login");
      return;
    }
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) {
      setBusy(false);
      setError(BAD_CODE);
    } else {
      window.location.replace("/");
    }
  };

  return (
    <>
      <p className="muted">Open your authenticator app and enter the 6-digit code for Fifth Gear.</p>
      <CodeForm label="Code" busy={busy} onSubmit={verify} />
    </>
  );
}

// First time only: connect an authenticator app to this account.
function SetupStep({ preview, setError }) {
  const [factor, setFactor] = useState(null); // { id, qr, secret, uri }
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (preview) {
      setFactor({ id: "preview", qr: null, secret: "JBSWY3DPEHPK3PXP", uri: "#" });
      return;
    }
    (async () => {
      const sb = supabaseBrowser();
      // Clear out any half-finished setup from before, then start fresh.
      const { data: list } = await sb.auth.mfa.listFactors();
      for (const f of list?.all || []) {
        if (f.status !== "verified") await sb.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Fifth Gear" });
      if (error) return setError(error.message);
      setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri });
    })().catch((e) => setError(e.message));
  }, []);

  const verify = async (code) => {
    if (preview) return;
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) {
      setBusy(false);
      setError(BAD_CODE);
    } else {
      window.location.replace("/");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(factor.secret);
      setCopied(true);
    } catch {}
  };

  if (!factor) return <p className="muted">Getting your setup key...</p>;

  return (
    <>
      <p className="list-title">Turn on two-step sign-in</p>
      <p className="muted">
        This is a one-time step. After it, signing in takes your password plus a 6-digit code from an authenticator app.
      </p>

      <p className="list-title">1. Add Fifth Gear to your authenticator</p>
      <a className="btn big link-as-btn" href={factor.uri}>
        Add to Passwords app
      </a>
      <p className="muted small">
        On iPhone this opens the Passwords app. If it doesn't, copy the setup key below and paste it into your
        authenticator app.
      </p>
      <div className="card setup-key">
        <span className="muted small">Setup key</span>
        <span className="secret">{factor.secret}</span>
        <button type="button" className="btn small-btn" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {factor.qr && (
        <>
          <p className="muted small">On another device, you can scan this instead:</p>
          <img className="qr" src={factor.qr} alt="QR code for your authenticator app" />
        </>
      )}

      <p className="list-title">2. Enter the code it shows</p>
      <CodeForm label="Code" busy={busy} onSubmit={verify} />
    </>
  );
}
