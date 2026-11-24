"use client";

// Spoken callouts and beeps. iPhone only allows sound after a tap, so
// unlockAudio() must be called from a button press (the Start button).

let ctx = null;

// How the app shares sound with your music app (newer iOS). "ambient" plays
// beeps over your music without stopping it. "transient-solo" pauses your
// music for a moment, then lets it carry on, which is what callouts use.
function setSession(type) {
  try {
    if (navigator.audioSession) navigator.audioSession.type = type;
  } catch {}
}

export function unlockAudio() {
  setSession("ambient");
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch {}
}

export function beep(high = false) {
  if (!ctx) return;
  try {
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
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = "en-GB";
    u.rate = 1.05;
    // Pause the music while the callout speaks, then hand it back.
    setSession("transient-solo");
    const done = () => {
      if (!synth.speaking && !synth.pending) setSession("ambient");
    };
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
  } catch {}
}

export function stopVoice() {
  try {
    window.speechSynthesis?.cancel();
  } catch {}
  setSession("ambient");
}
