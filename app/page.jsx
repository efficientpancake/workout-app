"use client";

import { useEffect, useState } from "react";
import { useWakeLock } from "../lib/useWakeLock";

const STORAGE_KEY = "coach-stopwatch-v1";

// Time is computed from timestamps, never by counting ticks, so the clock
// stays right if the screen sleeps, you switch apps, or iOS reloads the page.
const EMPTY = { running: false, startedAt: 0, banked: 0, laps: [] };

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function saveState(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

function elapsedOf(s, now) {
  return s.banked + (s.running ? now - s.startedAt : 0);
}

function format(ms) {
  const totalTenths = Math.floor(ms / 100);
  const tenths = totalTenths % 10;
  const totalSec = Math.floor(totalTenths / 10);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60) % 60;
  const hr = Math.floor(totalSec / 3600);
  const mmss = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return { main: hr ? `${hr}:${mmss}` : mmss, tenths: `.${tenths}` };
}

export default function Stopwatch() {
  const [state, setState] = useState(EMPTY);
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(loadState());
    setNow(Date.now());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveState(state);
  }, [state, ready]);

  useEffect(() => {
    if (!state.running) return;
    let frame;
    const tick = () => {
      setNow(Date.now());
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [state.running]);

  useWakeLock(state.running);

  const elapsed = elapsedOf(state, now);
  const lapTotal = state.laps.reduce((a, b) => a + b, 0);
  const currentLap = elapsed - lapTotal;

  const startStop = () => {
    const t = Date.now();
    setNow(t);
    setState((s) =>
      s.running
        ? { ...s, running: false, banked: elapsedOf(s, t) }
        : { ...s, running: true, startedAt: t }
    );
  };

  const lapOrReset = () => {
    const t = Date.now();
    setNow(t);
    setState((s) => {
      if (!s.running) return EMPTY;
      const total = elapsedOf(s, t);
      const done = s.laps.reduce((a, b) => a + b, 0);
      return { ...s, laps: [...s.laps, total - done] };
    });
  };

  const time = format(elapsed);
  const canReset = state.running || elapsed > 0;
  const showLaps = state.laps.length > 0;

  return (
    <main className="screen">
      <div className="time" aria-live="off">
        {time.main}
        <span className="tenths">{time.tenths}</span>
      </div>

      <div className="controls">
        <button className="btn" onClick={lapOrReset} disabled={!canReset}>
          {state.running ? "Lap" : "Reset"}
        </button>
        <button className={`btn ${state.running ? "stop" : "go"}`} onClick={startStop}>
          {state.running ? "Stop" : elapsed > 0 ? "Resume" : "Start"}
        </button>
      </div>

      {showLaps && (
        <ol className="laps">
          <li className="current">
            <span className="label">Lap {state.laps.length + 1}</span>
            <span>{format(currentLap).main}{format(currentLap).tenths}</span>
          </li>
          {state.laps
            .map((ms, i) => ({ ms, n: i + 1 }))
            .reverse()
            .map(({ ms, n }) => (
              <li key={n}>
                <span className="label">Lap {n}</span>
                <span>{format(ms).main}{format(ms).tenths}</span>
              </li>
            ))}
        </ol>
      )}
    </main>
  );
}
