// The rule-based coach. No AI and no cost: it compares your day and your last
// week with your goals, and suggests top-ups from foods you already eat.
// Each tip is { kind: "good" | "warn" | "tip" | "info", text }.
import { totalsFor } from "./nutrition";
import { localDate } from "./db";

function shift(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

const sum = (rows, key) => rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
const fmt = (n) => Math.round(n).toLocaleString();

// The best food from your usual list for a nutrient: most of it per calorie,
// at least `min` grams, and (when you have a target) fits in what's left.
function bestFood(foods, key, min, caloriesLeft) {
  let best = null;
  for (const f of foods) {
    const t = totalsFor(f.food, f.amount, f.unit);
    if (!t.calories || t[key] == null || t[key] < min) continue;
    if (caloriesLeft != null && t.calories > caloriesLeft) continue;
    const score = t[key] / t.calories;
    if (!best || score > best.score) best = { name: f.food.name, grams: t[key], calories: t.calories, score };
  }
  return best;
}

// profile: saved goals. entries: the viewed day's food. byDay: calories per
// day for recent days. foods: your favorites and recent foods.
export function coachTips({ profile, entries, byDay, foods, date, isToday }) {
  if (!profile) return [];
  const tips = [];
  const eaten = sum(entries, "calories");
  const target = profile.calorie_target;
  const left = target ? target - eaten : null;

  if (!entries.length) {
    tips.push({
      kind: "info",
      text: isToday ? "Nothing logged yet today. Log your first meal and I'll start tracking." : "Nothing was logged this day.",
    });
  } else {
    // Calories
    if (left != null && left < 0) {
      const biggest = [...entries].sort((a, b) => (b.calories || 0) - (a.calories || 0))[0];
      const extra = entries.length > 1 ? ` The biggest item was ${biggest.food.name} at ${fmt(biggest.calories)}.` : "";
      tips.push({ kind: "warn", text: `${fmt(-left)} calories over ${isToday ? "today" : "that day"}.${extra}` });
    }

    // Protein
    const protein = sum(entries, "protein");
    if (profile.protein_target) {
      if (protein >= profile.protein_target) {
        tips.push({ kind: "good", text: "Protein goal hit." });
      } else {
        const need = profile.protein_target - protein;
        const pick = isToday ? bestFood(foods, "protein", 5, left != null ? Math.max(left, 0) : null) : null;
        const how = pick
          ? ` From your usual foods, ${pick.name} adds ${fmt(pick.grams)} g for ${fmt(pick.calories)} calories.`
          : isToday
            ? " Eggs, Greek yogurt, chicken, fish, tofu and lentils are all high in protein."
            : "";
        tips.push({ kind: "tip", text: `${fmt(need)} g protein ${isToday ? "to go" : "short"}.${how}` });
      }
    }

    // Fiber
    const fiber = sum(entries, "fiber");
    if (profile.fiber_target) {
      if (fiber >= profile.fiber_target) {
        tips.push({ kind: "good", text: "Fiber goal hit." });
      } else {
        const need = profile.fiber_target - fiber;
        const pick = isToday ? bestFood(foods, "fiber", 2, left != null ? Math.max(left, 0) : null) : null;
        const how = pick
          ? ` From your usual foods, ${pick.name} adds ${fmt(pick.grams)} g for ${fmt(pick.calories)} calories.`
          : isToday
            ? " Beans, lentils, oats, berries, whole grains and vegetables are all high in fiber."
            : "";
        tips.push({ kind: "tip", text: `${fmt(need)} g fiber ${isToday ? "to go" : "short"}.${how}` });
      }
    }
  }

  // Weekly average over the 7 days ending on the viewed day, counting only
  // days with something logged.
  if (target) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = shift(date, -i);
      if (byDay[d] > 0) days.push(byDay[d]);
    }
    if (days.length >= 3) {
      const avg = days.reduce((a, b) => a + b, 0) / days.length;
      const diff = avg - target;
      tips.push({
        kind: diff <= 0 ? "good" : "warn",
        text: `Last 7 days: you averaged ${fmt(avg)} calories on the ${days.length} days you logged, ${fmt(Math.abs(diff))} ${diff <= 0 ? "under" : "over"} your target.`,
      });
    } else if (isToday) {
      tips.push({ kind: "info", text: "Log a few more days and I'll show your weekly average." });
    }
  }

  // Logging streak (today only).
  if (isToday) {
    const loggedToday = byDay[date] > 0;
    let n = 0;
    for (let d = loggedToday ? date : shift(date, -1); byDay[d] > 0; d = shift(d, -1)) n++;
    if (n >= 2) {
      tips.push(
        loggedToday
          ? { kind: "good", text: `${n} days logged in a row.` }
          : { kind: "tip", text: `${n} days logged in a row. Log today to keep it going.` }
      );
    }
  }

  return tips;
}
