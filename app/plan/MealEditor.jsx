"use client";

import { useState } from "react";
import FoodPicker from "../food/FoodPicker";
import { deleteMeal, saveMeal } from "../../lib/db";
import { describeAmount, totalsFor } from "../../lib/nutrition";
import { mealTotals } from "../../lib/meals";

// Build or edit a meal: a name, the foods in it, and how many servings it makes.
export default function MealEditor({ meal, onDone, onCancel }) {
  const [name, setName] = useState(meal?.name || "");
  const [servings, setServings] = useState(String(meal?.servings ?? 1));
  const [items, setItems] = useState(meal?.items || []);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (picking) {
    return (
      <FoodPicker
        title="Add an ingredient"
        subtitle={name ? `For ${name}` : null}
        addLabel="Add to meal"
        excludeMeals
        onCancel={() => setPicking(false)}
        onSave={({ food, amount, unit }) => {
          setItems((list) => [...list, { food, amount, unit }]);
          setPicking(false);
        }}
      />
    );
  }

  const n = Number(servings) > 0 ? Number(servings) : 1;
  const { total, perServing } = mealTotals({ items, servings: n });
  const valid = name.trim() && items.length > 0 && Number(servings) > 0;

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await saveMeal({ id: meal?.id, name: name.trim(), servings: n, items });
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${meal.name}? It also comes off your plan.`)) return;
    try {
      await deleteMeal(meal.id);
      onDone();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="run-head">
        <button className="link-btn plain-left" onClick={onCancel}>Back</button>
      </div>
      <h1 className="run-title">{meal ? "Edit meal" : "New meal"}</h1>

      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken and rice" />
      </label>

      <label className="field">
        <span>Makes how many servings?</span>
        <input
          inputMode="decimal"
          value={servings}
          onChange={(e) => setServings(e.target.value.replace(/[^\d.]/g, ""))}
        />
      </label>

      <p className="list-title">In this meal</p>
      {items.length ? (
        <ul className="entry-list">
          {items.map((it, i) => (
            <li key={i}>
              <div>
                <span className="fl-name">{it.food.name}</span>
                <span className="muted small">{describeAmount(it.food, it.amount, it.unit)}</span>
              </div>
              <div className="entry-right">
                <span>{totalsFor(it.food, it.amount, it.unit).calories ?? "?"}</span>
                <button
                  className="remove"
                  onClick={() => setItems((list) => list.filter((_, j) => j !== i))}
                  aria-label={`Remove ${it.food.name}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nothing yet. Add the foods that go in it.</p>
      )}

      <button className="btn big" onClick={() => setPicking(true)}>
        Add an ingredient
      </button>

      {items.length > 0 && (
        <div className="card">
          <p className="big-number">{perServing.calories ?? "?"} calories a serving</p>
          <p className="muted">
            Protein {perServing.protein ?? 0} g · Fiber {perServing.fiber ?? 0} g a serving
          </p>
          <p className="muted small">
            Whole meal: {total.calories ?? "?"} calories, {n} {n === 1 ? "serving" : "servings"}
          </p>
        </div>
      )}

      <button className="btn go big" disabled={!valid || busy} onClick={save}>
        {busy ? "Saving..." : "Save meal"}
      </button>
      {meal && (
        <button className="link-btn plain" onClick={remove}>
          Delete this meal
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </>
  );
}
