"use client";

import { useCallback, useEffect, useState } from "react";
import Scanner from "./Scanner";
import AddFood from "./AddFood";
import ManualFood from "./ManualFood";
import { addFavorite, foodKey, listFavorites, recentFoods, removeFavorite } from "../../lib/db";
import { defaultAmount, describeAmount, lookupBarcode, searchFoods, servingWord, totalsFor } from "../../lib/nutrition";

// Find a food and pick how much: scan, search, your meals, favorites, recent,
// or type it in. Used by the Food tab (log it), and the Plan tab (add it to a
// meal or a day). onSave({ food, amount, unit, totals }) does the saving.
export default function FoodPicker({
  title,
  subtitle,
  onSave,
  onCancel,
  extraLists = [],
  excludeMeals = false,
  addLabel = "Add",
  doneLink = null,
}) {
  const [view, setView] = useState("list");
  const [picked, setPicked] = useState(null); // { food, initial }
  const [manualBarcode, setManualBarcode] = useState(null);
  const [recent, setRecent] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState("");

  const keep = (list) => (excludeMeals ? list.filter((it) => it.food.source !== "meal") : list);

  useEffect(() => {
    recentFoods().then(setRecent).catch(() => {});
    listFavorites().then(setFavorites).catch(() => {});
  }, []);

  const favByKey = new Map(favorites.map((f) => [foodKey(f.food), f]));

  // Star or unstar. A new favorite keeps the amount you used last time.
  const toggleFavorite = async (item) => {
    const existing = favByKey.get(foodKey(item.food));
    try {
      if (existing) await removeFavorite(existing.id);
      else {
        const { amount, unit } = item.amount ? item : defaultAmount(item.food);
        await addFavorite(item.food, amount, unit);
      }
      setFavorites(await listFavorites());
    } catch (e) {
      setStatus(e.message);
    }
  };

  const doSave = async (food, amount, unit) => {
    await onSave({ food, amount, unit, totals: totalsFor(food, amount, unit) });
    setAdded(`Added ${food.name}, ${describeAmount(food, amount, unit)}.`);
    recentFoods().then(setRecent).catch(() => {});
  };

  // One tap: use your usual amount.
  const quickAdd = async (item) => {
    try {
      await doSave(item.food, item.amount, item.unit);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setStatus(e.message);
    }
  };

  const pick = (food, initial = defaultAmount(food)) => {
    setPicked({ food, initial });
    setView("add");
    setStatus("");
  };

  const onCode = useCallback(async (code) => {
    setView("list");
    setStatus("Looking up that barcode...");
    try {
      const r = await lookupBarcode(code);
      if (r.food) pick(r.food);
      else {
        setManualBarcode(code);
        setStatus(
          r.noCalories
            ? `Found ${r.name || "it"}, but it has no calorie info. Add it yourself below.`
            : "That barcode isn't in the food database. Add it yourself below."
        );
      }
    } catch (e) {
      setStatus(e.message);
    }
  }, []);

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setStatus("Searching...");
    setResults(null);
    try {
      const r = await searchFoods(query.trim());
      setResults(r);
      setStatus(
        r.dishes.length || r.packaged.length ? r.trouble : "Nothing found. Try fewer words, or add it yourself."
      );
    } catch (err) {
      setStatus(err.message);
    }
  };

  const save = async ({ amount, unit }) => {
    setBusy(true);
    try {
      await doSave(picked.food, amount, unit);
      setPicked(null);
      setManualBarcode(null);
      setView("list");
      setStatus("");
    } catch (err) {
      setStatus(err.message);
    }
    setBusy(false);
  };

  if (view === "scan") {
    return (
      <>
        <div className="run-head">
          <button className="link-btn plain-left" onClick={() => setView("list")}>Back</button>
        </div>
        <h1 className="run-title">Scan a barcode</h1>
        <Scanner onCode={onCode} />
      </>
    );
  }

  if (view === "add" && picked) {
    return (
      <>
        <AddFood
          food={picked.food}
          initial={picked.initial}
          busy={busy}
          addLabel={addLabel}
          onAdd={save}
          onCancel={() => {
            setPicked(null);
            setView("list");
          }}
        />
        {status && <p className="error">{status}</p>}
      </>
    );
  }

  if (view === "manual") {
    return (
      <ManualFood
        barcode={manualBarcode}
        onDone={(food) => pick(food, { amount: 1, unit: "serving" })}
        onCancel={() => setView("list")}
      />
    );
  }

  const favs = keep(favorites);
  const recents = keep(recent).filter((r) => !favByKey.has(foodKey(r.food)));

  return (
    <>
      {onCancel && (
        <div className="run-head">
          <button className="link-btn plain-left" onClick={onCancel}>Back</button>
        </div>
      )}
      <h1 className="run-title">{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}

      {added && (
        <p className="success">
          {added} {doneLink}
        </p>
      )}

      <button className="btn go big scan-btn" onClick={() => { setAdded(""); setView("scan"); }}>
        Scan a barcode
      </button>

      <form className="row" onSubmit={search}>
        <input
          type="search"
          placeholder="Search foods, e.g. Fuel granola"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn small-btn" disabled={!query.trim()}>Search</button>
      </form>

      {status && <p className="muted">{status}</p>}

      {results && (
        <>
          <FoodList
            title="Dishes and basic foods"
            items={results.dishes.map((food) => ({ food }))}
            onPick={(it) => pick(it.food)}
          />
          <FoodList
            title="Packaged foods"
            items={results.packaged.map((food) => ({ food }))}
            onPick={(it) => pick(it.food)}
          />
        </>
      )}

      {!results &&
        extraLists.map((l) => (
          <FoodList
            key={l.title}
            title={l.title}
            items={l.items}
            onPick={(it) => pick(it.food, { amount: it.amount, unit: it.unit })}
            onQuick={quickAdd}
          />
        ))}

      {!results && favs.length > 0 && (
        <FoodList
          title="Favorites"
          items={favs}
          onPick={(it) => pick(it.food, { amount: it.amount, unit: it.unit })}
          onQuick={quickAdd}
          isFav={() => true}
          onStar={toggleFavorite}
        />
      )}

      {!results && recents.length > 0 && (
        <FoodList
          title="Recent"
          items={recents}
          onPick={(it) => pick(it.food, { amount: it.amount, unit: it.unit })}
          onQuick={quickAdd}
          isFav={() => false}
          onStar={toggleFavorite}
        />
      )}

      {!results && favorites.length === 0 && recent.length > 0 && (
        <p className="muted small">Tap the star on a food you have often to keep it at the top.</p>
      )}

      <button className="link-btn plain" onClick={() => { setAdded(""); setView("manual"); }}>
        Can't find it? Add it yourself
      </button>
    </>
  );
}

// A list of foods. Tap a food to choose the amount. Lists with onQuick get a
// one-tap Add that uses the usual amount; lists with onStar get a star.
function FoodList({ title, items, onPick, onQuick, isFav, onStar }) {
  if (!items.length) return null;
  return (
    <>
      <p className="list-title">{title}</p>
      <ul className="food-list">
        {items.map((it, i) => {
          const usual = it.amount != null ? totalsFor(it.food, it.amount, it.unit).calories : null;
          const info = onQuick
            ? [it.food.brand, describeAmount(it.food, it.amount, it.unit), usual != null && `${usual} cal`]
            : [
                it.food.brand,
                it.food.nutrients.kcal != null &&
                  (servingWord(it.food, 1)
                    ? `${totalsFor(it.food, 1, "serving").calories} cal per ${servingWord(it.food, 1)}`
                    : `${Math.round(it.food.nutrients.kcal)} cal ${it.food.basis === "per100g" ? "per 100 g" : "per serving"}`),
              ];
          return (
            <li key={`${foodKey(it.food)}-${i}`} className={onQuick ? "with-actions" : ""}>
              <button className="fl-main" onClick={() => onPick(it)}>
                <span className="fl-name">{it.food.name}</span>
                <span className="muted small">{info.filter(Boolean).join(" · ")}</span>
              </button>
              {onStar && (
                <button
                  className={`star ${isFav(it) ? "on" : ""}`}
                  onClick={() => onStar(it)}
                  aria-label={isFav(it) ? `Remove ${it.food.name} from favorites` : `Add ${it.food.name} to favorites`}
                >
                  {isFav(it) ? "★" : "☆"}
                </button>
              )}
              {onQuick && (
                <button className="quick-add" onClick={() => onQuick(it)} aria-label={`Add ${it.food.name}`}>
                  Add
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
