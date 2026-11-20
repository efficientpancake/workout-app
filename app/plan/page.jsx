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

          {weekDays(monday).map((day) => {
            const rows = plan
              .filter((p) => p.plan_on === day)
              .map((p) => ({ item: p, food: planItemFood(p, mealsById) }))
              .filter((r) => r.food);
            const planned = rows.reduce((a, r) => a + (totalsFor(r.food, r.item.amount, r.item.unit).calories || 0), 0);
            const target = profile?.calorie_target;
            return (
              <div key={day} className={`card plan-day ${day === today ? "is-today" : ""}`}>
                <div className="plan-day-head">
                  <h2>{day === today ? `Today, ${dayName(day, { weekday: "long" })}` : dayName(day, { weekday: "long", day: "numeric" })}</h2>
                  {rows.length > 0 && (
                    <span className={`muted small ${target && planned > target ? "over" : ""}`}>
                      {Math.round(planned).toLocaleString()}
                      {target ? ` of ${target.toLocaleString()}` : ""} cal
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
                          ) : (
                            day <= today && (
                              <button className="quick-add" onClick={() => logIt(item, food)}>
                                Log it
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
                <button className="link-btn plain-left" onClick={() => setMode({ type: "pick", day })}>
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
