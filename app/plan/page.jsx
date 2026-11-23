"use client";

import { useEffect, useState } from "react";
import FoodPicker from "../food/FoodPicker";
import MealEditor from "./MealEditor";
import Shopping from "./Shopping";
import {
  addFood,
  addPlanItem,
  deletePlanItem,
  getProfile,
  listMeals,
  listPlan,
  listShopping,
  localDate,
  updatePlanItem,
} from "../../lib/db";
import { describeAmount, totalsFor } from "../../lib/nutrition";
import { mealToFood, mealTotals, planItemFood, shiftDate, weekDays, weekStart } from "../../lib/meals";
import { draftWeek, swapFor } from "../../lib/draft";

// Plan: your meals, the week ahead, and the shopping list.
const SECTIONS = [
  { id: "week", label: "Week" },
  { id: "meals", label: "Meals" },
  { id: "shopping", label: "Shopping" },
];

const dayName = (date, opts = { weekday: "long", month: "short", day: "numeric" }) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, opts);

export default function Plan() {
  const [section, setSection] = useState("week");
  const [monday, setMonday] = useState(null);
  const [profile, setProfile] = useState(null);
  const [meals, setMeals] = useState([]);
  const [plan, setPlan] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [mode, setMode] = useState(null); // { type: "pick", day } or { type: "meal", meal }
  const [status, setStatus] = useState("");
  const [showPast, setShowPast] = useState(false);

  const loadMeals = () => listMeals().then(setMeals).catch((e) => setStatus(e.message));

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("s");
    if (SECTIONS.some((x) => x.id === s)) setSection(s);
    setMonday(weekStart(localDate()));
    getProfile().then(setProfile).catch(() => {});
    loadMeals();
    listShopping().then(setShopping).catch((e) => setStatus(e.message));
  }, []);

  useEffect(() => {
    if (!monday) return;
    listPlan(monday, shiftDate(monday, 6)).then(setPlan).catch((e) => setStatus(e.message));
  }, [monday, meals]);

  const choose = (id) => {
    setSection(id);
    setStatus("");
    window.history.replaceState(null, "", id === "week" ? "/plan" : `/plan?s=${id}`);
  };

  if (!monday) return <main className="screen form-screen" />;

  const mealsById = new Map(meals.map((m) => [m.id, m]));
  const today = localDate();
  const sunday = shiftDate(monday, 6);
  const weekLabel =
    monday === weekStart(today)
      ? "this week"
      : `the week of ${dayName(monday, { month: "short", day: "numeric" })}`;

  if (mode?.type === "meal") {
    return (
      <main className="screen form-screen">
        <MealEditor
          meal={mode.meal}
          onCancel={() => setMode(null)}
          onDone={() => {
            setMode(null);
            loadMeals();
          }}
        />
      </main>
    );
  }

  if (mode?.type === "pick") {
    const day = mode.day;
    return (
      <main className="screen form-screen">
        <FoodPicker
          title={`Plan for ${dayName(day)}`}
          addLabel="Add to plan"
          onCancel={() => setMode(null)}
          extraLists={
            meals.length
              ? [{ title: "Your meals", items: meals.map((m) => ({ food: mealToFood(m), amount: 1, unit: "serving" })) }]
              : []
          }
          onSave={async ({ food, amount, unit }) => {
            const row =
              food.mealId && mealsById.has(food.mealId)
                ? { plan_on: day, meal_id: food.mealId, food: null, amount, unit: "serving", logged: false }
                : { plan_on: day, meal_id: null, food, amount, unit, logged: false };
            const made = await addPlanItem(row);
            setPlan((list) => [...list, made]);
          }}
          doneLink={
            <button className="link-btn plain-left inline" onClick={() => setMode(null)}>
              Back to the plan
            </button>
          }
        />
      </main>
    );
  }

  const logIt = async (item, food) => {
    try {
      await addFood({ eaten_on: item.plan_on, food, amount: item.amount, unit: item.unit, ...totalsFor(food, item.amount, item.unit) });
      await updatePlanItem(item.id, { logged: true });
      setPlan((list) => list.map((p) => (p.id === item.id ? { ...p, logged: true } : p)));
    } catch (e) {
      setStatus(e.message);
    }
  };

  const removeItem = async (item, food) => {
    if (!window.confirm(`Take ${food?.name || "this"} off the plan?`)) return;
    try {
      await deletePlanItem(item.id);
      setPlan((list) => list.filter((p) => p.id !== item.id));
    } catch (e) {
      setStatus(e.message);
    }
  };

  const target = profile?.calorie_target;
  const dayCalories = (day) =>
    plan
      .filter((p) => p.plan_on === day)
      .reduce((a, p) => {
        const food = planItemFood(p, mealsById);
        return a + (food ? totalsFor(food, p.amount, p.unit).calories || 0 : 0);
      }, 0);

  // Fills the empty days from today on (or the whole week, if it's ahead)
  // with your saved meals, staying under your target.
  const pastDays = weekDays(monday).filter((d) => d < today);
  const openDays = weekDays(monday).filter((d) => d >= today && !plan.some((p) => p.plan_on === d));
  const draft = async () => {
    setStatus("");
    const picks = draftWeek(openDays, meals, target);
    const rows = Object.entries(picks).flatMap(([day, ids]) =>
      ids.map((id) => ({ plan_on: day, meal_id: id, food: null, amount: 1, unit: "serving", logged: false }))
    );
    if (!rows.length) {
      setStatus("None of your meals fit under your target. Try adding a smaller meal.");
      return;
    }
    try {
      const made = [];
      for (const r of rows) made.push(await addPlanItem(r));
      setPlan((list) => [...list, ...made]);
      setStatus(`Planned ${Object.values(picks).filter((ids) => ids.length).length} days. Tap Swap on any meal you don't want.`);
    } catch (e) {
      setStatus(e.message);
    }
  };

  const swap = async (item) => {
    const next = swapFor(item.meal_id, meals, dayCalories(item.plan_on), target);
    if (!next) return;
    try {
      await updatePlanItem(item.id, { meal_id: next.id });
      setPlan((list) => list.map((p) => (p.id === item.id ? { ...p, meal_id: next.id } : p)));
    } catch (e) {
      setStatus(e.message);
    }
  };

  const logMeal = async (meal) => {
    const food = mealToFood(meal);
    try {
      await addFood({ eaten_on: today, food, amount: 1, unit: "serving", ...totalsFor(food, 1, "serving") });
      setStatus(`Logged 1 serving of ${meal.name} to today.`);
    } catch (e) {
      setStatus(e.message);
    }
  };

  return (
    <main className="screen form-screen">
      <h1 className="run-title">Plan</h1>
      <div className="seg">
        {SECTIONS.map((s) => (
          <button key={s.id} className={section === s.id ? "on" : ""} onClick={() => choose(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {section === "week" && (
        <>
          <div className="day-nav">
            <button className="link-btn plain-left" onClick={() => setMonday(shiftDate(monday, -7))} aria-label="Previous week">
              ‹ Back
            </button>
            <h2 className="week-title">
              {dayName(monday, { month: "short", day: "numeric" })} to {dayName(sunday, { month: "short", day: "numeric" })}
            </h2>
            <button className="link-btn plain-left" onClick={() => setMonday(shiftDate(monday, 7))} aria-label="Next week">
              Next ›
            </button>
          </div>

          {openDays.length === 0 && sunday <= shiftDate(today, 1) && (
            <div className="draft">
              <button className="btn go" onClick={() => setMonday(shiftDate(monday, 7))}>
                Plan next week
              </button>
            </div>
          )}

          {openDays.length > 0 && (
            <div className="draft">
              {!target ? (
                <p className="muted">
                  <a className="link-btn inline" href="/profile">Set your target</a> and the app can plan your week for you.
                </p>
              ) : meals.length === 0 ? (
                <p className="muted">
                  Save a few meals under Meals and the app can plan your week for you, under {target.toLocaleString()} cal a day.
                </p>
              ) : (
                <>
                  <button className="btn go" onClick={draft}>
                    Draft my week
                  </button>
                  <p className="muted small">
                    Fills the {openDays.length === 1 ? "empty day" : `${openDays.length} empty days`} with your meals, under{" "}
                    {target.toLocaleString()} cal a day.
                  </p>
                </>
              )}
            </div>
          )}

          {pastDays.length > 0 && !showPast && (
            <button className="link-btn plain-left" onClick={() => setShowPast(true)}>
              Show {pastDays.length === 1 ? "yesterday" : `the ${pastDays.length} earlier days`}
            </button>
          )}

          {weekDays(monday).filter((day) => showPast || day >= today).map((day) => {
            const rows = plan
              .filter((p) => p.plan_on === day)
              .map((p) => ({ item: p, food: planItemFood(p, mealsById) }))
              .filter((r) => r.food);
            const planned = rows.reduce((a, r) => a + (totalsFor(r.food, r.item.amount, r.item.unit).calories || 0), 0);
            return (
              <div key={day} className={`card plan-day ${day === today ? "is-today" : ""}`}>
                <div className="plan-day-head">
                  <h2>{day === today ? `Today, ${dayName(day, { weekday: "long" })}` : dayName(day, { weekday: "long", day: "numeric" })}</h2>
                  {rows.length > 0 && (
                    <span
                      className={`tag ${target ? (planned > target ? "over" : "under") : ""}`}
                      aria-label={`${Math.round(planned)} of ${target || "?"} calories planned`}
                    >
                      {Math.round(planned).toLocaleString()}
                      <small>{target ? `/ ${target.toLocaleString()}` : "cal"}</small>
                    </span>
                  )}
                </div>
                {rows.length > 0 && (
                  <ul className="entry-list">
                    {rows.map(({ item, food }) => (
                      <li key={item.id}>
                        <div>
                          <span className="fl-name">{food.name}</span>
                          <span className="muted small">
                            {describeAmount(food, item.amount, item.unit)} ·{" "}
                            {totalsFor(food, item.amount, item.unit).calories?.toLocaleString() ?? "?"} cal
                          </span>
                        </div>
                        <div className="entry-right">
                          {item.logged ? (
                            <span className="muted small">Logged</span>
                          ) : day <= today ? (
                            <button className="quick-add" onClick={() => logIt(item, food)}>
                              Log it
                            </button>
                          ) : (
                            item.meal_id &&
                            meals.length > 1 && (
                              <button className="swap" onClick={() => swap(item)} aria-label={`Swap ${food.name} for another meal`}>
                                Swap
                              </button>
                            )
                          )}
                          <button className="remove" onClick={() => removeItem(item, food)} aria-label={`Take ${food.name} off the plan`}>
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <button className="link-btn plain-left add-to-day" onClick={() => setMode({ type: "pick", day })}>
                  + Add to {dayName(day, { weekday: "long" })}
                </button>
              </div>
            );
          })}
        </>
      )}

      {section === "meals" && (
        <>
          <button className="btn go big" onClick={() => setMode({ type: "meal", meal: null })}>
            New meal
          </button>
          {meals.length === 0 ? (
            <p className="muted">
              No meals yet. A meal is a few foods you have together, like overnight oats or chicken and rice. Build it
              once, then log it or plan it in one tap.
            </p>
          ) : (
            <ul className="food-list">
              {meals.map((m) => {
                const per = mealTotals(m).perServing;
                return (
                  <li key={m.id} className="with-actions">
                    <button className="fl-main" onClick={() => setMode({ type: "meal", meal: m })}>
                      <span className="fl-name">{m.name}</span>
                      <span className="muted small">
                        {per.calories ?? "?"} cal · {per.protein ?? 0} g protein a serving · makes {m.servings}
                      </span>
                    </button>
                    <button className="quick-add" onClick={() => logMeal(m)} aria-label={`Log 1 serving of ${m.name} to today`}>
                      Log 1
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {meals.length > 0 && <p className="muted small">Tap a meal to change it. Log 1 adds one serving to today.</p>}
        </>
      )}

      {section === "shopping" && (
        <Shopping monday={monday} weekLabel={weekLabel} mealsById={mealsById} items={shopping} setItems={setShopping} />
      )}

      {status && <p className="muted">{status}</p>}
    </main>
  );
}
