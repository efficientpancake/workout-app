"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getProfile, saveProfile, signOut, usingCloud } from "../../lib/db";
import {
  ACTIVITY,
  PACES_KG,
  PACES_LB,
  cmToFtIn,
  ftInToCm,
  kgToLb,
  lbToKg,
  suggestTargets,
} from "../../lib/nutrition";

// Your stats and daily goals. The form shows kg/cm or lb/ft; everything is
// saved in kg and cm.
const BLANK = {
  units: "metric",
  sex: "",
  age: "",
  cm: "",
  ft: "",
  inches: "",
  weight: "",
  activity: "",
  pace: 0.5,
  calories: "",
  protein: "",
  fiber: "",
};

// Pace choices in kg per week for the current units (1 lb is 0.454 kg).
const paceOptions = (units) => (units === "imperial" ? PACES_LB.map(lbToKg) : PACES_KG);
const paceIndexFor = (units, pace) =>
  Math.max(0, paceOptions(units).findIndex((p) => Math.abs(p - Number(pace)) < 0.01));

export default function Profile() {
  const [form, setForm] = useState(BLANK);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const imperial = form.units === "imperial";

  // The form converted to the saved (metric) shape.
  const stats = useMemo(() => {
    const height_cm = imperial ? (form.ft !== "" ? ftInToCm(form.ft, form.inches) : null) : Number(form.cm) || null;
    const weight_kg = form.weight === "" ? null : imperial ? lbToKg(Number(form.weight)) : Number(form.weight);
    return {
      units: form.units,
      sex: form.sex || null,
      age: Number(form.age) || null,
      height_cm: height_cm ? Math.round(height_cm * 10) / 10 : null,
      weight_kg: weight_kg ? Math.round(weight_kg * 10) / 10 : null,
      activity: form.activity || null,
      pace_kg_week: Number(form.pace) || 0,
    };
  }, [form, imperial]);

  const suggested = suggestTargets(stats);

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (!p) return;
        const s = suggestTargets(p);
        const { ft, inches } = p.height_cm ? cmToFtIn(p.height_cm) : { ft: "", inches: "" };
        const keep = (saved, sug) => (saved && saved !== sug ? String(saved) : "");
        setForm({
          units: p.units || "metric",
          sex: p.sex || "",
          age: p.age ?? "",
          cm: p.height_cm ? String(Math.round(p.height_cm)) : "",
          ft: p.height_cm ? String(ft) : "",
          inches: p.height_cm ? String(inches) : "",
          weight: p.weight_kg
            ? String(p.units === "imperial" ? Math.round(kgToLb(p.weight_kg) * 10) / 10 : p.weight_kg)
            : "",
          activity: p.activity || "",
          pace: p.pace_kg_week ?? 0.5,
          calories: keep(p.calorie_target, s?.calories),
          protein: keep(p.protein_target, s?.protein),
          fiber: keep(p.fiber_target, s?.fiber),
        });
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoaded(true));
  }, []);

  // Switching units converts what's already typed.
  const switchUnits = (units) => {
    if (units === form.units) return;
    setForm((f) => {
      const next = { ...f, units };
      if (units === "imperial") {
        if (f.cm) Object.assign(next, Object.fromEntries(Object.entries(cmToFtIn(Number(f.cm))).map(([k, v]) => [k, String(v)])));
        if (f.weight) next.weight = String(Math.round(kgToLb(Number(f.weight)) * 10) / 10);
      } else {
        if (f.ft !== "") next.cm = String(Math.round(ftInToCm(f.ft, f.inches)));
        if (f.weight) next.weight = String(Math.round(lbToKg(Number(f.weight)) * 10) / 10);
      }
      // Keep the same pace button selected in the new units.
      next.pace = paceOptions(units)[paceIndexFor(f.units, f.pace)];
      return next;
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!suggested) {
      setMessage("Fill in every stat above so the app can work out your target.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await saveProfile({
        ...stats,
        calorie_target: Number(form.calories) || suggested.calories,
        protein_target: Number(form.protein) || suggested.protein,
        fiber_target: Number(form.fiber) || suggested.fiber,
      });
      window.location.assign("/today");
    } catch (err) {
      setMessage(err.message);
      setSaving(false);
    }
  };

  const paces = imperial ? PACES_LB : PACES_KG;
  const paceValue = (i) => paceOptions(form.units)[i];
  const paceIndex = paceIndexFor(form.units, form.pace);

  if (!loaded) return <main className="screen" />;

  return (
    <main className="screen form-screen">
      <div className="run-head">
        <Link className="link-btn plain-left" href="/today">Back</Link>
        {usingCloud && (
          <button className="link-btn plain-left" onClick={signOut}>Sign out</button>
        )}
      </div>
      <h1 className="run-title">Your goals</h1>

      <form onSubmit={save}>
        <div className="seg">
          <button type="button" className={!imperial ? "on" : ""} onClick={() => switchUnits("metric")}>kg, cm</button>
          <button type="button" className={imperial ? "on" : ""} onClick={() => switchUnits("imperial")}>lb, ft</button>
        </div>

        <label className="field">
          <span>Sex (for the calorie formula)</span>
          <select value={form.sex} onChange={(e) => set("sex", e.target.value)}>
            <option value="">Choose</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>

        <label className="field">
          <span>Age</span>
          <input inputMode="numeric" value={form.age} onChange={(e) => set("age", e.target.value.replace(/\D/g, ""))} />
        </label>

        {imperial ? (
          <div className="field">
            <span>Height</span>
            <div className="pair">
              <label><input inputMode="numeric" value={form.ft} onChange={(e) => set("ft", e.target.value.replace(/\D/g, ""))} /> ft</label>
              <label><input inputMode="numeric" value={form.inches} onChange={(e) => set("inches", e.target.value.replace(/\D/g, ""))} /> in</label>
            </div>
          </div>
        ) : (
          <label className="field">
            <span>Height (cm)</span>
            <input inputMode="numeric" value={form.cm} onChange={(e) => set("cm", e.target.value.replace(/\D/g, ""))} />
          </label>
        )}

        <label className="field">
          <span>Weight ({imperial ? "lb" : "kg"})</span>
          <input inputMode="decimal" value={form.weight} onChange={(e) => set("weight", e.target.value.replace(/[^\d.]/g, ""))} />
        </label>

        <label className="field">
          <span>How active are you?</span>
          <select value={form.activity} onChange={(e) => set("activity", e.target.value)}>
            <option value="">Choose</option>
            {ACTIVITY.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </label>

        <div className="field">
          <span>Weight loss per week</span>
          <div className="seg">
            {paces.map((p, i) => (
              <button
                type="button"
                key={p}
                className={i === paceIndex ? "on" : ""}
                onClick={() => set("pace", paceValue(i))}
              >
                {p === 0 ? "Maintain" : `${p} ${imperial ? "lb" : "kg"}`}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {suggested ? (
            <>
              <p className="big-number">{suggested.calories.toLocaleString()} calories a day</p>
              <p className="muted">
                Suggested. You'd maintain your weight at about {suggested.maintain.toLocaleString()}.
                {suggested.hitFloor && " This is the lowest target the app will suggest."}
              </p>
              <p className="muted small">
                An estimate from a standard formula, not medical advice. Adjust it if your weight isn't moving after a few weeks.
              </p>
            </>
          ) : (
            <p className="muted">Fill in your stats to see a suggested daily target.</p>
          )}
        </div>

        <p className="muted">Your daily goals. Leave a box empty to use the suggestion.</p>
        <label className="field">
          <span>Calories</span>
          <input inputMode="numeric" placeholder={suggested ? String(suggested.calories) : ""} value={form.calories} onChange={(e) => set("calories", e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="field">
          <span>Protein (g)</span>
          <input inputMode="numeric" placeholder={suggested ? String(suggested.protein) : ""} value={form.protein} onChange={(e) => set("protein", e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="field">
          <span>Fiber (g)</span>
          <input inputMode="numeric" placeholder={suggested ? String(suggested.fiber) : ""} value={form.fiber} onChange={(e) => set("fiber", e.target.value.replace(/\D/g, ""))} />
        </label>

        <button className="btn go big" disabled={saving}>{saving ? "Saving..." : "Save goals"}</button>
        {message && <p className="error">{message}</p>}
      </form>
    </main>
  );
}
