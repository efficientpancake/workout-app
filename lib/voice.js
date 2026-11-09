"use client";

// Spoken callouts and beeps. iPhone only allows sound after a tap, so
// unlockAudio() must be called from a button press (the Start button).

let ctx = null;

export function unlockAudio() {
  try {
    // Lets sound play even when the phone's silent switch is on (newer iOS).
    if (navigator.audioSession) navigator.audioSession.type = "playback";
  } catch {}
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

export function say(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    synth.speak(u);
  } catch {}
}

export function stopVoice() {
  try {
    window.speechSynthesis?.cancel();
  } catch {}
}
