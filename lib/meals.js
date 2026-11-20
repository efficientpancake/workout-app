// Meals, the weekly plan and the shopping list: the math, no storage.
import { totalsFor } from "./nutrition";
import { foodKey, localDate } from "./db";

const KEYS = ["calories", "protein", "carbs", "sugar", "fat", "fiber", "salt"];

export function shiftDate(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

// The Monday of the week a date is in.
export function weekStart(date) {
  const day = new Date(`${date}T12:00:00`).getDay(); // 0 = Sunday
  return shiftDate(date, -((day + 6) % 7));
}

export const weekDays = (monday) => Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));

// Totals for the whole meal and for one serving.
export function mealTotals(meal) {
  const total = Object.fromEntries(KEYS.map((k) => [k, null]));
  for (const it of meal.items || []) {
    const t = totalsFor(it.food, it.amount, it.unit);
    for (const k of KEYS) if (t[k] != null) total[k] = (total[k] || 0) + t[k];
  }
  const n = Number(meal.servings) > 0 ? Number(meal.servings) : 1;
  const r = (k, v) => (v == null ? null : k === "calories" ? Math.round(v) : Math.round(v * 10) / 10);
  const perServing = {};
  for (const k of KEYS) {
    perServing[k] = r(k, total[k] == null ? null : total[k] / n);
    total[k] = r(k, total[k]);
  }
  return { total, perServing };
}

// A meal as a food, so it can be logged, starred and re-added like any food.
// One serving of the food is one serving of the meal.
export function mealToFood(meal) {
  const p = mealTotals(meal).perServing;
  return {
    name: meal.name,
    brand: null,
    barcode: null,
    basis: "perServing",
    servingGrams: null,
    servingLabel: null,
    source: "meal",
    mealId: meal.id,
    nutrients: { kcal: p.calories, protein: p.protein, carbs: p.carbs, sugar: p.sugar, fat: p.fat, fiber: p.fiber, salt: p.salt },
  };
}

// The food a plan item stands for (a meal or a single food). Null if its meal
// was deleted.
export function planItemFood(item, mealsById) {
  if (item.meal_id) {
    const meal = mealsById.get(item.meal_id);
    return meal ? mealToFood(meal) : null;
  }
  return item.food;
}

const round1 = (v) => Math.round(v * 10) / 10;

function formatQty({ grams, servings, label }) {
  const parts = [];
  if (grams > 0) parts.push(grams >= 1000 ? `${round1(grams / 1000)} kg` : `${Math.round(grams)} g`);
  if (servings > 0) {
    const s = round1(servings);
    parts.push(label ? `${s} × ${label}` : `${s} ${s === 1 ? "serving" : "servings"}`);
  }
  return parts.join(" + ");
}

// Adds up every ingredient across the plan items you haven't logged yet.
// Meals are scaled by planned servings over the servings the meal makes.
export function shoppingFromPlan(items, mealsById) {
  const map = new Map();
  const add = (food, amount, unit) => {
    if (!food || !(amount > 0)) return;
    const key = foodKey(food);
    const cur = map.get(key) || {
      name: food.brand && !food.name.toLowerCase().includes(food.brand.toLowerCase()) ? `${food.name} (${food.brand})` : food.name,
      grams: 0,
      servings: 0,
      label: food.servingLabel,
    };
    if (unit === "g") cur.grams += amount;
    else if (food.servingGrams) cur.grams += food.servingGrams * amount;
    else cur.servings += amount;
    map.set(key, cur);
  };

  for (const it of items) {
    if (it.logged) continue;
    if (it.meal_id) {
      const meal = mealsById.get(it.meal_id);
      if (!meal) continue;
      const scale = Number(it.amount) / (Number(meal.servings) || 1);
      for (const ing of meal.items || []) add(ing.food, Number(ing.amount) * scale, ing.unit);
    } else {
      add(it.food, Number(it.amount), it.unit);
    }
  }

  return [...map.values()]
    .map((v) => ({ name: v.name, amount: formatQty(v) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
