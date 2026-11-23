"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  addFood,
  caloriesByDay,
  deleteFood,
  getProfile,
  listFavorites,
  listFood,
  listMeals,
  listPlan,
  localDate,
  recentFoods,
  updatePlanItem,
} from "../../lib/db";
import { describeAmount, totalsFor } from "../../lib/nutrition";
import { coachTips } from "../../lib/coach";
import { planItemFood, shiftDate } from "../../lib/meals";
import { dayStatus } from "../../lib/draft";

// One day at a glance: calories left in big type, what's planned next, and
// everything you logged.
const sum = (rows, key) => rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);

export default function Today() {
  const [date, setDate] = useState(null);
  const [profile, setProfile] = useState(undefined);
  const [entries, setEntries] = useState([]);
  const [byDay, setByDay] = useState({});
  const [foods, setFoods] = useState([]);
  const [planned, setPlanned] = useState([]);
  const [mealsById, setMealsById] = useState(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDate(new URLSearchParams(window.location.search).get("date") || localDate());
    getProfile().then(setProfile).catch((e) => setError(e.message));
    listMeals()
      .then((m) => setMealsById(new Map(m.map((x) => [x.id, x]))))
      .catch(() => {});
    // Your usual foods, for the coach's top-up suggestions.
    Promise.all([listFavorites(), recentFoods(50)])
      .then(([fav, rec]) => setFoods([...fav, ...rec]))
      .catch(() => {});
  }, []);

  const loadDay = (d) => {
    listFood(d).then(setEntries).catch((e) => setError(e.message));
    listPlan(d, d).then(setPlanned).catch(() => {});
    caloriesByDay(shiftDate(d, -40), d).then(setByDay).catch(() => {});
  };

  useEffect(() => {
    if (date) loadDay(date);
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

  const logPlanned = async (item, food) => {
    setBusy(true);
    try {
      await addFood({ eaten_on: item.plan_on, food, amount: item.amount, unit: item.unit, ...totalsFor(food, item.amount, item.unit) });
      await updatePlanItem(item.id, { logged: true });
      loadDay(date);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  if (!date || profile === undefined) return <main className="screen" />;

  const isToday = date === localDate();
  const label = isToday
    ? "Today"
    : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  const eaten = Math.round(sum(entries, "calories"));
  const target = profile?.calorie_target;
  const left = target ? target - eaten : null;
  const status = target ? dayStatus(eaten, target) : "under";

  const next = planned
    .filter((p) => !p.logged)
    .map((p) => ({ item: p, food: planItemFood(p, mealsById) }))
    .find((r) => r.food);
  const nextCal = next ? totalsFor(next.food, next.item.amount, next.item.unit).calories : null;

  return (
    <main className="screen form-screen">
      <div className="day-nav">
        <button className="link-btn plain-left" onClick={() => go(-1)} aria-label="Previous day">
          ‹ Back
        </button>
        <h1 className="run-title">{label}</h1>
        <button className="link-btn plain-left" onClick={() => go(1)} disabled={isToday} aria-label="Next day">
          Next ›
        </button>
      </div>

      {!profile ? (
        <div className="card">
          <p className="big-number">Set your target</p>
          <p className="muted">Enter your stats once and the app works out how much to eat each day to lose weight.</p>
          <Link className="btn go big link-as-btn" href="/profile">
            Set up
          </Link>
        </div>
      ) : (
        <section className="left-board" aria-label="Calories">
          <p className="left-label">{left >= 0 ? "Calories left" : "Calories over"}</p>
          <p className={`left-number ${left < 0 ? "over" : ""}`}>
            {Math.abs(left).toLocaleString()}
            <span className="unit">cal</span>
          </p>
          <div className="day-bar" role="img" aria-label={`${eaten} of ${target} calories eaten`}>
            <span className={status} style={{ width: `${Math.min(100, (eaten / target) * 100)}%` }} />
          </div>
          <p className="left-meta">
            <span>{eaten.toLocaleString()} eaten</span>
            <span>Target {target.toLocaleString()}</span>
          </p>
          <div className="macros">
            <Bar className="macro" value={sum(entries, "protein")} goal={profile.protein_target} label="Protein" unit=" g" />
            <Bar className="macro" value={sum(entries, "fiber")} goal={profile.fiber_target} label="Fiber" unit=" g" />
          </div>
        </section>
      )}

      {next && (
        <section className="card next-up">
          <h2>Next on your plan</h2>
          <div className="next-row">
            <p className="next-name">{next.food.name}</p>
            {nextCal != null && (
              <span className="tag">
                {nextCal.toLocaleString()}
                <small>cal</small>
              </span>
            )}
          </div>
          <p className="muted small">{describeAmount(next.food, next.item.amount, next.item.unit)}</p>
          <div className="next-actions">
            <button className="btn go" disabled={busy} onClick={() => logPlanned(next.item, next.food)}>
              {busy ? "Logging..." : "Log it"}
            </button>
            <Link className="link-btn plain-left" href="/plan">
              See the plan
            </Link>
          </div>
        </section>
      )}

      <Link className="btn go big link-as-btn" href={isToday ? "/food" : `/food?date=${date}`}>
        Add food
      </Link>

      {profile && (
        <section className="card coach">
          <h2>Coach</h2>
          <ul>
            {coachTips({ profile, entries, byDay, foods, date, isToday }).map((t, i) => (
              <li key={i} className={t.kind}>
                {t.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="list-title">Eaten {isToday ? "today" : "this day"}</h2>
      {entries.length > 0 ? (
        <div className="card">
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
          <p className="muted small">
            Carbs {Math.round(sum(entries, "carbs"))} g · Sugar {Math.round(sum(entries, "sugar"))} g · Fat{" "}
            {Math.round(sum(entries, "fat"))} g
          </p>
        </div>
      ) : (
        <p className="muted">Nothing logged {isToday ? "yet today" : "this day"}.</p>
      )}

      {profile && (
        <Link className="link-btn plain" href="/profile">
          Edit your target
        </Link>
      )}
      {error && <p className="error">{error}</p>}
    </main>
  );
}

function Bar({ value, goal, label, unit, className = "" }) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div className={`bar ${className}`}>
      <div className="bar-text">
        <span>{label}</span>
        <span>
          {Math.round(value).toLocaleString()}
          {goal ? ` / ${goal.toLocaleString()}` : ""}
          {unit}
        </span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
