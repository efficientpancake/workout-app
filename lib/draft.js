// Drafting a week of meals under your calorie target. Pure math, no storage.
import { mealTotals } from "./meals";

// How a day lands against the target: on track, close (within 10%), or over.
export function dayStatus(calories, target) {
  if (!target) return "under";
  if (calories > target) return "over";
  if (calories >= target * 0.9) return "close";
  return "under";
}

const mealCal = (m) => mealTotals(m).perServing.calories || 0;

// All ways to pick 1 to `max` different meals from a list.
function combos(list, max) {
  const out = [];
  const walk = (start, picked) => {
    if (picked.length) out.push(picked);
    if (picked.length === max) return;
    for (let i = start; i < list.length; i++) walk(i + 1, [...picked, list[i]]);
  };
  walk(0, []);
  return out;
}

// Fills each day with one serving each of up to four of your saved meals.
// Every day lands between 85% and 100% of the target when your meals allow
// it. Among those mixes it picks the one that repeats yesterday the least,
// then uses this week's meals the least, then gets closest to the target.
// Returns { day: [mealId, ...] } for the days you pass in.
export function draftWeek(days, meals, target) {
  const usable = meals.filter((m) => mealCal(m) > 0 && mealCal(m) <= target).slice(0, 16);
  if (!usable.length || !target) return {};
  const fits = combos(usable, 4)
    .map((mix) => ({ ids: mix.map((m) => m.id), total: mix.reduce((a, m) => a + mealCal(m), 0) }))
    .filter((o) => o.total <= target);
  const inRange = fits.filter((o) => o.total >= target * 0.85);
  // If nothing reaches 85%, use the biggest mixes you have.
  const pool = inRange.length ? inRange : fits.filter((o) => o.total >= Math.max(...fits.map((f) => f.total)) * 0.95);

  const plan = {};
  let yesterday = [];
  const used = {};
  for (const day of days) {
    const rank = (o) => [
      o.ids.filter((id) => yesterday.includes(id)).length,
      o.ids.reduce((a, id) => a + (used[id] || 0), 0),
      -o.total,
    ];
    let best = null;
    for (const o of pool) {
      if (!best) best = o;
      else {
        const a = rank(o);
        const b = rank(best);
        const i = a.findIndex((v, k) => v !== b[k]);
        if (i !== -1 && a[i] < b[i]) best = o;
      }
    }
    plan[day] = best ? best.ids : [];
    yesterday = plan[day];
    for (const id of yesterday) used[id] = (used[id] || 0) + 1;
  }
  return plan;
}

// The next meal to swap in: the first one, after the current one in your
// list, that keeps the day at or under the target. Falls back to the next
// meal in the list if none fits.
export function swapFor(currentId, meals, dayCalories, target) {
  const usable = meals.filter((m) => mealCal(m) > 0);
  if (usable.length < 2) return null;
  const start = usable.findIndex((m) => m.id === currentId);
  const current = usable[start];
  const without = dayCalories - (current ? mealCal(current) : 0);
  for (let k = 1; k < usable.length; k++) {
    const m = usable[(start + k + usable.length) % usable.length];
    if (!target || without + mealCal(m) <= target) return m;
  }
  return usable[(start + 1) % usable.length];
}
