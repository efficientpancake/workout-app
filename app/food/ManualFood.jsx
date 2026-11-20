"use client";

import { useState } from "react";
import { NUTRIENTS } from "../../lib/nutrition";

// Type in a food yourself: a name, calories, and anything else you know.
// Saved per serving, so next time it's in your recent foods.
export default function ManualFood({ barcode, onDone, onCancel }) {
  const [name, setName] = useState("");
  const [values, setValues] = useState({ kcal: "" });
  const set = (k, v) => setValues((s) => ({ ...s, [k]: v.replace(/[^\d.]/g, "") }));

  const submit = (e) => {
    e.preventDefault();
    const n = (k) => (values[k] === undefined || values[k] === "" ? null : Number(values[k]));
    onDone({
      name: name.trim(),
      brand: null,
      barcode: barcode || null,
      basis: "perServing",
      servingGrams: null,
      servingLabel: null,
      source: "manual",
      nutrients: {
        kcal: n("kcal"),
        protein: n("protein"),
        carbs: n("carbs"),
        sugar: n("sugar"),
        fat: n("fat"),
        fiber: n("fiber"),
        salt: n("salt"),
      },
    });
  };

  return (
    <form className="add-food" onSubmit={submit}>
      <h2 className="food-name">Add it yourself</h2>
      <p className="muted small">For one serving. Only the name and calories are needed.</p>
      <label className="field">
        <span>Food</span>
        <input value={name} placeholder="e.g. Chicken salad from work" onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="field">
        <span>Calories</span>
        <input inputMode="numeric" value={values.kcal} onChange={(e) => set("kcal", e.target.value)} required />
      </label>
      <div className="nutrient-inputs">
        {NUTRIENTS.map((n) => (
          <label className="field" key={n.key}>
            <span>{n.label} ({n.unit})</span>
            <input inputMode="decimal" value={values[n.key] ?? ""} onChange={(e) => set(n.key, e.target.value)} />
          </label>
        ))}
      </div>
      <button className="btn go big" disabled={!name.trim() || values.kcal === ""}>Next</button>
      <button type="button" className="link-btn plain" onClick={onCancel}>Cancel</button>
    </form>
  );
}
