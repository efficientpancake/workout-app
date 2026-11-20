// Calorie target math, unit conversions, and food lookups.

// ---- Units ----

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const kgToLb = (kg) => kg / KG_PER_LB;
export const lbToKg = (lb) => lb * KG_PER_LB;

export function cmToFtIn(cm) {
  const totalIn = cm / CM_PER_IN;
  let ft = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - ft * 12);
  if (inches === 12) {
    ft += 1;
    inches = 0;
  }
  return { ft, inches };
}

export const ftInToCm = (ft, inches) => (Number(ft) * 12 + Number(inches || 0)) * CM_PER_IN;

// ---- Calorie target ----

export const ACTIVITY = [
  { id: "sedentary", label: "Mostly sitting, little exercise", factor: 1.2 },
  { id: "light", label: "Exercise 1 to 3 days a week", factor: 1.375 },
  { id: "moderate", label: "Exercise 3 to 5 days a week", factor: 1.55 },
  { id: "very", label: "Exercise 6 or 7 days a week", factor: 1.725 },
];

// Weekly loss options, stored in kg. Shown as kg or lb.
export const PACES_KG = [0, 0.25, 0.5, 0.75];
export const PACES_LB = [0, 0.5, 1, 1.5];

// A common rule of thumb: about 7,700 calories per kg of body fat
// (about 3,500 per lb). An estimate, not exact.
const KCAL_PER_KG = 7700;

// Mifflin-St Jeor resting calories.
export function restingCalories({ sex, weight_kg, height_cm, age }) {
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

// Suggested daily targets from your stats. Returns null until the stats are
// filled in.
export function suggestTargets(p) {
  const { sex, weight_kg, height_cm, age, activity, pace_kg_week } = p;
  if (!sex || !weight_kg || !height_cm || !age || !activity) return null;
  const factor = ACTIVITY.find((a) => a.id === activity)?.factor ?? 1.2;
  const maintain = restingCalories(p) * factor;
  const deficit = ((pace_kg_week || 0) * KCAL_PER_KG) / 7;
  const floor = sex === "male" ? 1500 : 1200;
  const calories = Math.max(floor, Math.round((maintain - deficit) / 10) * 10);
  return {
    maintain: Math.round(maintain / 10) * 10,
    calories,
    hitFloor: maintain - deficit < floor,
    // 1.6 g of protein per kg of body weight, a common goal while losing weight.
    protein: Math.round(weight_kg * 1.6),
    // US daily fiber guidance: 25 g for women, 38 g for men.
    fiber: sex === "male" ? 38 : 25,
  };
}

// ---- Food amounts ----

export const NUTRIENTS = [
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "sugar", label: "Sugar", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "fiber", label: "Fiber", unit: "g" },
  { key: "salt", label: "Salt", unit: "g" },
];

// How many "basis units" the chosen amount is. A food's nutrients are stored
// either per 100 g or per serving.
function factorFor(food, amount, unit) {
  const n = Number(amount) || 0;
  if (food.basis === "per100g") {
    if (unit === "g") return n / 100;
    return ((food.servingGrams || 100) * n) / 100;
  }
  return n; // perServing: amount is always servings
}

export function totalsFor(food, amount, unit) {
  const f = factorFor(food, amount, unit);
  const round1 = (v) => (v == null ? null : Math.round(v * f * 10) / 10);
  return {
    calories: food.nutrients.kcal == null ? null : Math.round(food.nutrients.kcal * f),
    protein: round1(food.nutrients.protein),
    carbs: round1(food.nutrients.carbs),
    sugar: round1(food.nutrients.sugar),
    fat: round1(food.nutrients.fat),
    fiber: round1(food.nutrients.fiber),
    salt: round1(food.nutrients.salt),
  };
}

// Default amount when you pick a food: 1 serving if we know its size,
// otherwise 100 g.
export function defaultAmount(food) {
  if (food.basis === "perServing" || food.servingGrams) return { amount: 1, unit: "serving" };
  return { amount: 100, unit: "g" };
}

export function describeAmount(food, amount, unit) {
  if (unit === "g") return `${amount} g`;
  const s = Number(amount) === 1 ? "serving" : "servings";
  if (food.servingGrams) return `${amount} ${s} (${Math.round(food.servingGrams * Number(amount))} g)`;
  if (food.servingLabel) return `${amount} × ${food.servingLabel}`;
  return `${amount} ${s}`;
}

// ---- Open Food Facts (free public food database, no key) ----

const OFF = "https://world.openfoodfacts.org";
const FIELDS = "code,product_name,generic_name,brands,serving_size,serving_quantity,nutriments";

const num = (v) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? null : Number(v));

// Turns an Open Food Facts product into our food shape. Null if it has no
// calorie info.
export function fromOpenFoodFacts(p) {
  const n = p.nutriments || {};
  const pick = (suffix) => ({
    kcal: num(n[`energy-kcal${suffix}`]) ?? (num(n[`energy${suffix}`]) != null ? num(n[`energy${suffix}`]) / 4.184 : null),
    protein: num(n[`proteins${suffix}`]),
    carbs: num(n[`carbohydrates${suffix}`]),
    sugar: num(n[`sugars${suffix}`]),
    fat: num(n[`fat${suffix}`]),
    fiber: num(n[`fiber${suffix}`]),
    salt: num(n[`salt${suffix}`]),
  });
  const per100 = pick("_100g");
  const perServing = pick("_serving");
  const servingGrams = num(p.serving_quantity);
  const name = (p.product_name || p.generic_name || "").trim() || "Unnamed product";
  const brand = (Array.isArray(p.brands) ? p.brands[0] || "" : (p.brands || "").split(",")[0]).trim() || null;
  const base = { name, brand, barcode: p.code || null, servingLabel: p.serving_size || null, source: "openfoodfacts" };

  if (per100.kcal != null) {
    return { ...base, basis: "per100g", servingGrams: servingGrams || null, nutrients: round(per100) };
  }
  if (perServing.kcal != null) {
    return { ...base, basis: "perServing", servingGrams: servingGrams || null, nutrients: round(perServing) };
  }
  return null;
}

function round(nutrients) {
  const out = {};
  for (const [k, v] of Object.entries(nutrients)) out[k] = v == null ? null : Math.round(v * 10) / 10;
  return out;
}

// Look up one barcode. Returns { food } or { notFound: true } or { noCalories, name }.
export async function lookupBarcode(code) {
  const res = await fetch(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw new Error("The food database didn't respond. Try again.");
  const data = await res.json();
  if (data.status !== 1 || !data.product) return { notFound: true };
  const food = fromOpenFoodFacts({ ...data.product, code });
  if (!food) return { noCalories: true, name: data.product.product_name || null };
  return { food };
}

// Search by name. Returns foods that have calorie info.
// Goes through the app's own server (app/api/food-search), because the food
// database blocks search calls made straight from a browser.
export async function searchFoods(query) {
  const res = await fetch(`/api/food-search?q=${encodeURIComponent(query)}`);
  if (res.status === 503) {
    throw new Error("The food database is busy. Wait a minute and search again, or scan the barcode.");
  }
  if (!res.ok) throw new Error("The food database didn't respond. Try again.");
  const data = await res.json();
  return (data.products || []).map(fromOpenFoodFacts).filter(Boolean);
}
