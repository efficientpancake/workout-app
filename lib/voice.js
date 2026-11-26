"use client";

// Spoken callouts and beeps. iPhone only allows sound after a tap, so
// unlockAudio() must be called from a button press (the Start button).

let ctx = null;

// How the app shares sound with your music app (newer iOS). "ambient" plays
// beeps over your music without stopping it. "transient" turns your music
// down while a callout speaks, then back up, so it never stops.
function setSession(type) {
  try {
    if (navigator.audioSession) navigator.audioSession.type = type;
  } catch {}
}

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export function unlockAudio() {
  setSession("ambient");
  try {
    if (getCtx().state !== "running") ctx.resume();
  } catch {}
}

// ---- Recorded callouts ----
// iPhone's live voice stops your music, so callouts are recorded clips
// (public/callouts, made by scripts/record-callouts.mjs) played the same way
// as the beeps. Any line without a clip falls back to the live voice.

let index = null;
const clips = new Map();
let playing = null;

async function loadIndex() {
  if (!index) index = fetch("/callouts/index.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return index;
}

// Fetches and decodes a workout's clips ahead of time so they play at once.
export async function preloadLines(lines) {
  try {
    const map = await loadIndex();
    const c = getCtx();
    await Promise.all(
      lines
        .filter((t) => map[t] && !clips.has(t))
        .map(async (t) => {
          const res = await fetch(`/callouts/${map[t]}`);
          if (!res.ok) return;
          clips.set(t, await c.decodeAudioData(await res.arrayBuffer()));
        })
    );
  } catch {}
}

function stopClip() {
  try {
    playing?.stop();
  } catch {}
  playing = null;
}

function playClip(text) {
  const buf = clips.get(text);
  if (!buf || !ctx) return false;
  try {
    stopClip();
    // iPhone can leave the sound "interrupted" (not just "suspended") after
    // other apps play; wake it either way. Stay "ambient" so the clip plays
    // over your music: switching the session mid-workout silenced the clips.
    if (ctx.state !== "running") ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => {
      if (playing === src) playing = null;
    };
    playing = src;
    src.start();
    return true;
  } catch {
    return false;
  }
}

export function beep(high = false) {
  if (!ctx) return;
  try {
    if (ctx.state !== "running") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = high ? 1320 : 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (high ? 0.35 : 0.15));
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

// Always a British male voice. Best first: Apple's higher-quality British
// male voices, then Daniel (built into every iPhone and Mac), then other
// British male voices, then any British voice.
const BRITISH_MALE = [
  /arthur/i,
  /daniel.*(enhanced|premium)/i,
  /oliver/i,
  /daniel/i,
  /google uk english male/i,
  /^(reed|eddy|rocko)\b/i,
];

let voice = null;

function pickVoice() {
  if (voice) return voice;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const gb = voices.filter((v) => /^en[-_]GB/i.test(v.lang));
  for (const pattern of BRITISH_MALE) {
    const match = gb.find((v) => pattern.test(v.name)) || voices.find((v) => pattern.test(v.name) && /^en/i.test(v.lang));
    if (match) return (voice = match);
  }
  return (voice = gb[0] || null);
}

// Voices load a moment after the page opens; pick again once they arrive.
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    voice = null;
    pickVoice();
  });
}

export function currentVoiceName() {
  return pickVoice()?.name ?? null;
}

export function say(text) {
  if (playClip(text)) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = "en-GB";
    u.rate = 1.05;
    // Turn the music down while the callout speaks, then back up.
    setSession("transient");
    const done = () => {
      if (!synth.speaking && !synth.pending) setSession("ambient");
    };
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
  } catch {}
}

export function stopVoice() {
  stopClip();
  try {
    window.speechSynthesis?.cancel();
  } catch {}
  setSession("ambient");
}
