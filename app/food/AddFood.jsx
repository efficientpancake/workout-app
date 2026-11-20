"use client";

import { useState } from "react";
import { NUTRIENTS, describeAmount, totalsFor } from "../../lib/nutrition";

// Pick how much you ate, see the totals, add it.
export default function AddFood({ food, initial, onAdd, onCancel, busy, addLabel = "Add" }) {
  const [amount, setAmount] = useState(String(initial.amount));
  const [unit, setUnit] = useState(initial.unit);
  const canUseGrams = food.basis === "per100g";
  const totals = totalsFor(food, amount, unit);
  const valid = Number(amount) > 0;

  const switchUnit = (u) => {
    if (u === unit) return;
    setUnit(u);
    if (u === "g") setAmount(String(food.servingGrams ? Math.round(food.servingGrams * (Number(amount) || 1)) : 100));
    else setAmount("1");
  };

  return (
    <div className="add-food">
      <h2 className="food-name">{food.name}</h2>
      {food.brand && <p className="muted">{food.brand}</p>}
      {food.servingLabel && <p className="muted small">Serving: {food.servingLabel}</p>}

      <div className="amount-row">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          aria-label="Amount"
        />
        {canUseGrams ? (
          <div className="seg">
            <button
              type="button"
              className={unit === "serving" ? "on" : ""}
              onClick={() => switchUnit("serving")}
              disabled={!food.servingGrams}
            >
              Servings
            </button>
            <button type="button" className={unit === "g" ? "on" : ""} onClick={() => switchUnit("g")}>
              Grams
            </button>
          </div>
        ) : (
          <span className="muted">servings</span>
        )}
      </div>

      <div className="card">
        <p className="big-number">{totals.calories ?? "?"} calories</p>
        <div className="nutrient-grid">
          {NUTRIENTS.map((n) => (
            <div key={n.key}>
              <span className="muted">{n.label}</span>
              <span>{totals[n.key] == null ? "–" : `${totals[n.key]} ${n.unit}`}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        className="btn go big"
        disabled={!valid || busy}
        onClick={() => onAdd({ amount: Number(amount), unit, totals, label: describeAmount(food, amount, unit) })}
      >
        {busy ? "Adding..." : addLabel}
      </button>
      <button type="button" className="link-btn plain" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
