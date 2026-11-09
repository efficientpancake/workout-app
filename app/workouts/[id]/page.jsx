"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getWorkout, blockSeconds, workoutSeconds } from "../../../lib/workouts";
import { useWakeLock } from "../../../lib/useWakeLock";
import { unlockAudio, beep, say, stopVoice } from "../../../lib/voice";

// Phases: "ready" (before the workout), "running" (a block is on the clock),
// "between" (a block just ended: either a timed transition, or waiting for
// you to tap Start), "done".
// All timing is from timestamps, so pausing, sleeping or reloading never
// loses time.
const FRESH = {
  phase: "ready",
  block: 0,
  lastBlock: null,
  startedAt: 0,
  pausedAt: null,
  pushStartedAt: null,
  betweenStartedAt: null,
  meters: {},
};

function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const isEasy = (label) => /^(Base|Walk|Rest)/.test(label);
const introOf = (b) => b.intro ?? `${b.title}.`;

// Where are we inside an intervals block, t ms after it started?
function stepAt(block, t) {
  let acc = 0;
  for (let i = 0; i < block.steps.length; i++) {
    const end = acc + block.steps[i].sec * 1000;
    if (t < end) return { idx: i, left: end - t };
    acc = end;
  }
  return null; // block finished
}

export default function Runner() {
  const { id } = useParams();
  const router = useRouter();
  const workout = getWorkout(id);
  const key = `coach-run-${id}`;

  const [run, setRun] = useState(FRESH);
  const [now, setNow] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const runRef = useRef(run);
  runRef.current = run;
  const fired = useRef(new Set());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved) setRun({ ...FRESH, ...saved });
    } catch {}
    setNow(Date.now());
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(run));
    } catch {}
  }, [run, loaded, key]);

  useWakeLock(run.phase === "running" || run.phase === "between");

  // Starts the block the run is pointing at. Called by the Start button and
  // by the end of a timed transition.
  const beginBlock = (t = Date.now()) => {
    const idx = runRef.current.block;
    const b = workout.blocks[idx];
    fired.current = new Set();
    if (b.type === "intervals") {
      fired.current.add(`s-${idx}-0`);
      say(b.steps[0].say);
    } else {
      const mins = b.sec / 60;
      say(`Go. ${Number.isInteger(mins) ? mins : mins.toFixed(1)} minutes.`);
    }
    setNow(t);
    setRun((s) => ({ ...s, phase: "running", startedAt: t, pausedAt: null, pushStartedAt: null, betweenStartedAt: null }));
  };
  const beginRef = useRef(beginBlock);
  beginRef.current = beginBlock;

  // The coach: runs 10 times a second, fires callouts and beeps once each.
  const timedBreak = run.phase === "between" && Boolean(workout?.transitionSec);
  const coaching = (run.phase === "running" && !run.pausedAt) || timedBreak;

  useEffect(() => {
    if (!coaching) return;
    const once = (k, fn) => {
      if (fired.current.has(k)) return;
      fired.current.add(k);
      fn();
    };

    const tick = () => {
      const t0 = Date.now();
      setNow(t0);
      const r = runRef.current;

      // Timed transition between blocks.
      if (r.phase === "between") {
        if (!workout.transitionSec || !r.betweenStartedAt) return;
        const left = workout.transitionSec * 1000 - (t0 - r.betweenStartedAt);
        const secLeft = Math.ceil(left / 1000);
        if (left <= 0) {
          beep(true);
          beginRef.current(t0);
        } else {
          if (secLeft <= 10 && secLeft > 7) once(`t10-${r.block}`, () => say("10 seconds. Get set."));
          if (secLeft <= 3) once(`tb-${r.block}-${secLeft}`, () => beep());
        }
        return;
      }

      if (r.phase !== "running" || r.pausedAt) return;
      const b = workout.blocks[r.block];
      const t = t0 - r.startedAt;

      let blockOver = false;
      if (b.type === "intervals") {
        const at = stepAt(b, t);
        if (!at) blockOver = true;
        else {
          once(`s-${r.block}-${at.idx}`, () => {
            if (at.idx > 0) beep(true);
            say(b.steps[at.idx].say);
          });
          const secLeft = Math.ceil(at.left / 1000);
          if (secLeft <= 3) once(`b-${r.block}-${at.idx}-${secLeft}`, () => beep());
        }
      } else {
        const left = b.sec * 1000 - t;
        if (left <= 0) blockOver = true;
        else {
          const secLeft = Math.ceil(left / 1000);
          const fin = b.finisher;
          if (fin && secLeft <= fin.sec) {
            once(`f-${r.block}`, () => {
              beep(true);
              say(fin.say);
            });
          } else if (fin && secLeft <= fin.sec + 10 && secLeft > fin.sec + 7) {
            once(`f10-${r.block}`, () => say("Finisher in 10 seconds."));
          }
          if (!fin && secLeft <= 60 && secLeft > 57) once(`m1-${r.block}`, () => say("One minute left."));
          if (secLeft <= 30 && secLeft > 27 && !(fin && fin.sec === 30)) once(`s30-${r.block}`, () => say("30 seconds left."));
          if (secLeft <= 3) once(`cb-${r.block}-${secLeft}`, () => beep());

          if (r.pushStartedAt && b.push) {
            const pushLeft = b.push.sec * 1000 - (t0 - r.pushStartedAt);
            const pushSec = Math.ceil(pushLeft / 1000);
            if (pushLeft <= 0) {
              beep(true);
              say("Back to the rower.");
              setRun((s) => ({ ...s, pushStartedAt: null }));
            } else if (pushSec <= 3) {
              once(`pb-${r.pushStartedAt}-${pushSec}`, () => beep());
            }
          }
        }
      }

      if (blockOver) {
        beep(true);
        const next = workout.blocks[r.block + 1];
        const check = b.logDistance ? "Check your rower distance. " : "";
        if (next) {
          const when = workout.transitionSec
            ? `${workout.transitionSec} seconds to get set.`
            : "Tap start when ready.";
          say(`Time. ${check}Next up, ${introOf(next)} ${when}`);
          setRun((s) => ({
            ...s,
            phase: "between",
            lastBlock: s.block,
            block: s.block + 1,
            pushStartedAt: null,
            betweenStartedAt: t0,
          }));
        } else {
          say(`Time. ${check}Workout done. Nice work.`);
          setRun((s) => ({ ...s, phase: "done", lastBlock: s.block, pushStartedAt: null }));
        }
      }
    };

    tick();
    const iv = setInterval(tick, 100);
    return () => clearInterval(iv);
  }, [coaching, run.phase, run.block, workout]);

  if (!workout) {
    return (
      <main className="screen">
        <p>That workout isn't in the library.</p>
        <Link className="btn" href="/workouts">Back to workouts</Link>
      </main>
    );
  }

  const block = workout.blocks[run.block];

  const startBlock = () => {
    unlockAudio();
    beginBlock();
  };

  const pause = () => {
    stopVoice();
    setRun((s) => ({ ...s, pausedAt: Date.now() }));
  };

  const resume = () => {
    unlockAudio();
    const t = Date.now();
    setRun((s) => {
      const d = t - s.pausedAt;
      return {
        ...s,
        pausedAt: null,
        startedAt: s.startedAt + d,
        pushStartedAt: s.pushStartedAt ? s.pushStartedAt + d : null,
      };
    });
  };

  // Intervals: jump to the next step. Circuit: end the block now.
  const skip = () => {
    const t = Date.now();
    setRun((s) => {
      const elapsed = (s.pausedAt ?? t) - s.startedAt;
      const b = workout.blocks[s.block];
      const jump = b.type === "intervals" ? (stepAt(b, elapsed)?.left ?? 0) : b.sec * 1000 - elapsed;
      return { ...s, startedAt: s.startedAt - jump - 1 };
    });
  };

  const startPush = () => {
    unlockAudio();
    say(`Push. ${block.push.sec} seconds.`);
    setRun((s) => ({ ...s, pushStartedAt: Date.now() }));
  };

  const end = () => {
    if ((run.phase === "running" || run.phase === "between") && !window.confirm("End this workout?")) return;
    stopVoice();
    try {
      localStorage.removeItem(key);
    } catch {}
    setRun(FRESH);
    router.push("/workouts");
  };

  const setMeters = (i, v) => setRun((s) => ({ ...s, meters: { ...s.meters, [i]: v } }));

  const header = (
    <div className="run-head">
      <button className="link-btn" onClick={end}>
        {run.phase === "done" ? "Close" : "End"}
      </button>
      <span className="muted">
        {run.phase === "ready" || run.phase === "done"
          ? workout.name
          : `Block ${run.block + 1} of ${workout.blocks.length}`}
      </span>
    </div>
  );

  const distanceBox =
    run.lastBlock !== null && workout.blocks[run.lastBlock].logDistance ? (
      <label className="field">
        <span>Rower meters for {workout.blocks[run.lastBlock].title}</span>
        <input
          inputMode="numeric"
          placeholder="e.g. 850"
          value={run.meters[run.lastBlock] ?? ""}
          onChange={(e) => setMeters(run.lastBlock, e.target.value.replace(/\D/g, ""))}
        />
      </label>
    ) : null;

  // READY
  if (run.phase === "ready") {
    return (
      <main className="screen run">
        {header}
        <h1 className="run-title">{workout.name}</h1>
        <p className="muted">
          {workout.blocks.length} blocks, about {Math.round(workoutSeconds(workout) / 60)} minutes of work
          {workout.transitionSec ? `, ${workout.transitionSec} sec breaks between blocks` : ""}
        </p>
        <ol className="block-list">
          {workout.blocks.map((b, i) => (
            <li key={i}>
              <span>{b.title}</span>
              <span className="muted">{clock(blockSeconds(b) * 1000)}</span>
            </li>
          ))}
        </ol>
        <p className="muted small">Turn your volume up. Keep this screen open during the workout.</p>
        <button className="btn go big" onClick={startBlock}>Start</button>
      </main>
    );
  }

  // BETWEEN BLOCKS
  if (run.phase === "between") {
    const breakLeft = workout.transitionSec
      ? workout.transitionSec * 1000 - (now - (run.betweenStartedAt ?? now))
      : null;
    return (
      <main className="screen run">
        {header}
        {distanceBox}
        {breakLeft !== null && (
          <div className="break">
            <span>Transition</span>
            <span className="push-clock">{clock(breakLeft)}</span>
          </div>
        )}
        <p className="muted">Next up</p>
        <h1 className="run-title">{block.title}</h1>
        <BlockPreview block={block} />
        <button className="btn go big" onClick={startBlock}>
          {breakLeft !== null ? "Start now" : "Start"}
        </button>
      </main>
    );
  }

  // DONE
  if (run.phase === "done") {
    const logged = workout.blocks
      .map((b, i) => ({ b, i }))
      .filter(({ b, i }) => b.logDistance && run.meters[i]);
    return (
      <main className="screen run">
        {header}
        <h1 className="run-title">Workout done</h1>
        {distanceBox}
        {logged.length > 0 && (
          <ol className="block-list">
            {logged.map(({ b, i }) => (
              <li key={i}>
                <span>{b.title}</span>
                <span>{run.meters[i]} m</span>
              </li>
            ))}
          </ol>
        )}
        <button className="btn big" onClick={end}>Back to workouts</button>
      </main>
    );
  }

  // RUNNING
  const t = (run.pausedAt ?? now) - run.startedAt;
  const paused = Boolean(run.pausedAt);
  let main;

  if (block.type === "intervals") {
    const at = stepAt(block, t) ?? { idx: block.steps.length - 1, left: 0 };
    const step = block.steps[at.idx];
    const nextStep = block.steps[at.idx + 1];
    const blockLeft = blockSeconds(block) * 1000 - t;
    main = (
      <>
        <p className="muted">{block.title}</p>
        <div className={`step-label ${isEasy(step.label) ? "calm" : "hard"}`}>{step.label}</div>
        {step.note && <p className="step-note">{step.note}</p>}
        <div className="countdown">{clock(at.left)}</div>
        <p className="muted">
          Step {at.idx + 1} of {block.steps.length} · Block ends in {clock(blockLeft)}
        </p>
        <p className="next">
          {nextStep
            ? `Next: ${nextStep.label}${nextStep.note ? `, ${nextStep.note}` : ""} ${clock(nextStep.sec * 1000)}`
            : "Last one"}
        </p>
      </>
    );
  } else {
    const left = block.sec * 1000 - t;
    const fin = block.finisher;
    const inFinisher = fin && left <= fin.sec * 1000;
    const pushLeft = run.pushStartedAt ? block.push.sec * 1000 - ((run.pausedAt ?? now) - run.pushStartedAt) : null;
    const target = block.beatBlock !== undefined ? run.meters[block.beatBlock] : null;
    main = (
      <>
        <p className="muted">{block.title}</p>
        {inFinisher && <div className="step-label hard">Finisher: {fin.label}</div>}
        <div className="countdown">{clock(left)}</div>
        {target && <p className="target">Beat {target} m</p>}
        <ul className={`moves ${inFinisher ? "dim" : ""}`}>
          {block.moves.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        {fin && !inFinisher && (
          <p className="muted">
            Last {clock(fin.sec * 1000)}: finisher, {fin.label.toLowerCase()}
          </p>
        )}
        {block.push &&
          (pushLeft !== null && pushLeft > 0 ? (
            <div className="push-live">
              <span>{block.push.label}</span>
              <span className="push-clock">{clock(pushLeft)}</span>
            </div>
          ) : (
            <button className="btn push" onClick={startPush} disabled={paused}>
              Start {block.push.sec} sec {block.push.label.toLowerCase()}
            </button>
          ))}
      </>
    );
  }

  return (
    <main className="screen run">
      {header}
      {main}
      <div className="controls run-controls">
        <button className="btn" onClick={skip}>Skip</button>
        {paused ? (
          <button className="btn go" onClick={resume}>Resume</button>
        ) : (
          <button className="btn stop" onClick={pause}>Pause</button>
        )}
      </div>
    </main>
  );
}

function BlockPreview({ block }) {
  if (block.type === "circuit") {
    return (
      <>
        <p className="muted">{clock(block.sec * 1000)}, repeat until time</p>
        <ul className="moves">
          {block.moves.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        {block.finisher && (
          <p className="muted">
            Finisher: last {clock(block.finisher.sec * 1000)}, {block.finisher.label.toLowerCase()}
          </p>
        )}
      </>
    );
  }
  return (
    <ol className="block-list">
      {block.steps.map((s, i) => (
        <li key={i}>
          <span>
            {s.label}
            {s.note ? <span className="muted small"> · {s.note}</span> : null}
          </span>
          <span className="muted">{clock(s.sec * 1000)}</span>
        </li>
      ))}
    </ol>
  );
}
