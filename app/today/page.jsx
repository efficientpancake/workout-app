"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  caloriesByDay,
  deleteFood,
  getProfile,
  listFavorites,
  listFood,
  localDate,
  recentFoods,
} from "../../lib/db";
import { describeAmount } from "../../lib/nutrition";
import { coachTips } from "../../lib/coach";

// One day at a glance: calories eaten against your target, protein and fiber
// against your goals, and everything you logged.
function shiftDate(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

const sum = (rows, key) => rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);

export default function Today() {
  const [date, setDate] = useState(null);
  const [profile, setProfile] = useState(undefined);
  const [entries, setEntries] = useState([]);
  const [byDay, setByDay] = useState({});
  const [foods, setFoods] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setDate(new URLSearchParams(window.location.search).get("date") || localDate());
    getProfile().then(setProfile).catch((e) => setError(e.message));
    // Your usual foods, for the coach's top-up suggestions.
    Promise.all([listFavorites(), recentFoods(50)])
      .then(([fav, rec]) => setFoods([...fav, ...rec]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!date) return;
    listFood(date).then(setEntries).catch((e) => setError(e.message));
    caloriesByDay(shiftDate(date, -40), date).then(setByDay).catch(() => {});
  }, [date]);

  const go = (days) => {
    const next = shiftDate(date, days);
    setDate(next);
    const url = next === localDate() ? "/today" : `/today?date=${next}`;
    window.history.replaceState(null, "", url);
  };

  const remove = async (entry) => {
    if (!window.confirm(`Remove ${entry.food.name}?`)) return;
    try {
      await deleteFood(entry.id);
      setEntries((list) => list.filter((e) => e.id !== entry.id));
      caloriesByDay(shiftDate(date, -40), date).then(setByDay).catch(() => {});
    } catch (e) {
      setError(e.message);
    }
  };

  if (!date || profile === undefined) return <main className="screen" />;

  const isToday = date === localDate();
  const label = isToday
    ? "Today"
    : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  const eaten = Math.round(sum(entries, "calories"));
  const target = profile?.calorie_target;
  const left = target ? target - eaten : null;

  return (
    <main className="screen form-screen">
      <div className="day-nav">
        <button className="link-btn plain-left" onClick={() => go(-1)} aria-label="Previous day">‹ Back</button>
        <h1 className="run-title">{label}</h1>
        <button
          className="link-btn plain-left"
          onClick={() => go(1)}
          disabled={isToday}
          aria-label="Next day"
        >
          Next ›
        </button>
      </div>

      {!profile ? (
        <div className="card">
          <p className="big-number">Set your goals</p>
          <p className="muted">Enter your stats once and the app works out your daily calorie target.</p>
          <Link className="btn go big link-as-btn" href="/profile">Set up</Link>
        </div>
      ) : (
        <div className="card">
          <p className={`big-number ${left < 0 ? "over" : ""}`}>
            {left >= 0 ? `${left.toLocaleString()} calories left` : `${Math.abs(left).toLocaleString()} calories over`}
          </p>
          <Bar value={eaten} goal={target} label="Eaten" unit="" />
          <Bar value={sum(entries, "protein")} goal={profile.protein_target} label="Protein" unit=" g" />
          <Bar value={sum(entries, "fiber")} goal={profile.fiber_target} label="Fiber" unit=" g" />
          <p className="muted small">
            Carbs {Math.round(sum(entries, "carbs"))} g · Sugar {Math.round(sum(entries, "sugar"))} g · Fat{" "}
            {Math.round(sum(entries, "fat"))} g
          </p>
        </div>
      )}

      <Link className="btn go big link-as-btn" href={isToday ? "/food" : `/food?date=${date}`}>
        Add food
      </Link>

      {profile && (
        <div className="card coach">
          <h2>Coach</h2>
          <ul>
            {coachTips({ profile, entries, byDay, foods, date, isToday }).map((t, i) => (
              <li key={i} className={t.kind}>
                {t.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {entries.length > 0 ? (
        <ul className="entry-list">
          {entries.map((e) => (
            <li key={e.id}>
              <div>
                <span className="fl-name">{e.food.name}</span>
                <span className="muted small">{describeAmount(e.food, e.amount, e.unit)}</span>
              </div>
              <div className="entry-right">
                <span>{Math.round(e.calories || 0)}</span>
                <button className="remove" onClick={() => remove(e)} aria-label={`Remove ${e.food.name}`}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nothing logged {isToday ? "yet today" : "this day"}.</p>
      )}

      {profile && (
        <Link className="link-btn plain" href="/profile">Edit your goals</Link>
      )}
      {error && <p className="error">{error}</p>}
    </main>
  );
}

function Bar({ value, goal, label, unit }) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div className="bar">
      <div className="bar-text">
        <span>{label}</span>
        <span>
          {Math.round(value).toLocaleString()}
          {unit} {goal ? `of ${goal.toLocaleString()}${unit}` : ""}
        </span>
      </div>
      <div className="bar-track">
        <div className={`bar-fill ${value > goal && label === "Eaten" ? "over" : ""}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
