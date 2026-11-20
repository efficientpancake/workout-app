"use client";

import { useState } from "react";
import { addShopping, deleteShopping, listPlan, updateShopping } from "../../lib/db";
import { shiftDate, shoppingFromPlan } from "../../lib/meals";

// The shopping list: built from the week's plan, plus anything you type in.
// Tick things off at the store.
export default function Shopping({ monday, weekLabel, mealsById, items, setItems }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");

  const build = async () => {
    setStatus("");
    try {
      const plan = await listPlan(monday, shiftDate(monday, 6));
      const fresh = shoppingFromPlan(plan, mealsById);
      if (!fresh.length) {
        setStatus("Nothing to buy from that week yet. Plan some meals or foods first.");
        return;
      }
      await deleteShopping(items.filter((i) => i.from_plan).map((i) => i.id));
      const made = await addShopping(fresh.map((f) => ({ ...f, from_plan: true, checked: false })));
      setItems([...items.filter((i) => !i.from_plan), ...made]);
      setStatus(`Added ${made.length} ${made.length === 1 ? "item" : "items"} from the plan.`);
    } catch (e) {
      setStatus(e.message);
    }
  };

  const addOwn = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const made = await addShopping([{ name: text.trim(), amount: null, checked: false, from_plan: false }]);
      setItems([...items, ...made]);
      setText("");
    } catch (err) {
      setStatus(err.message);
    }
  };

  const toggle = async (item) => {
    setItems(items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)));
    try {
      await updateShopping(item.id, { checked: !item.checked });
    } catch (e) {
      setStatus(e.message);
    }
  };

  const clearTicked = async () => {
    try {
      await deleteShopping(items.filter((i) => i.checked).map((i) => i.id));
      setItems(items.filter((i) => !i.checked));
    } catch (e) {
      setStatus(e.message);
    }
  };

  const todo = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);

  return (
    <>
      <button className="btn go big" onClick={build}>
        Build from {weekLabel}
      </button>
      <p className="muted small">
        Adds up the ingredients for everything planned that week that you haven't logged yet. Items you typed in stay.
      </p>

      <form className="row" onSubmit={addOwn}>
        <input placeholder="Add your own, e.g. milk" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn small-btn" disabled={!text.trim()}>Add</button>
      </form>

      {status && <p className="muted">{status}</p>}

      {items.length === 0 ? (
        <p className="muted">Your list is empty.</p>
      ) : (
        <ul className="check-list">
          {[...todo, ...done].map((i) => (
            <li key={i.id}>
              <button className={i.checked ? "checked" : ""} onClick={() => toggle(i)} aria-pressed={i.checked}>
                <span className="box" aria-hidden="true">{i.checked ? "✓" : ""}</span>
                <span className="check-text">
                  <span className="fl-name">{i.name}</span>
                  {i.amount && <span className="muted small">{i.amount}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <button className="link-btn plain" onClick={clearTicked}>
          Clear ticked ({done.length})
        </button>
      )}
    </>
  );
}
