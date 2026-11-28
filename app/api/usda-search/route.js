// Searches the USDA's free food database (FoodData Central) for everyday
// dishes and basic foods, like homemade mac and cheese or scrambled eggs.
// Goes through the app's server so the USDA key stays out of the browser.
// Protected by the sign-in lock like every other page.
const USDA_SEARCH = "https://api.nal.usda.gov/fdc/v1/foods/search";

// Everyday words the USDA names differently.
const SWAPS = [
  [/\bmac\b/g, "macaroni"],
  [/\bmac n\b/g, "macaroni and"],
  [/&/g, " and "],
  [/\bhome ?made\b/g, ""],
  [/\bspag\b/g, "spaghetti"],
  [/\bpb\b/g, "peanut butter"],
];

function tidy(q) {
  let s = q.toLowerCase();
  for (const [from, to] of SWAPS) s = s.replace(from, to);
  return s.replace(/\s+/g, " ").trim();
}

async function ask(query, requireAllWords) {
  const res = await fetch(`${USDA_SEARCH}?api_key=${encodeURIComponent(process.env.USDA_API_KEY || "DEMO_KEY")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      // "Survey" foods are dishes as people eat them, with cup and piece sizes.
      dataType: ["Survey (FNDDS)"],
      pageSize: 20,
      requireAllWords,
    }),
    cache: "no-store",
  });
  if (res.status === 429) return { busy: true };
  if (!res.ok) return { failed: true };
  return { foods: (await res.json()).foods || [] };
}

const NUTRIENT_IDS = {
  kcal: [1008, 2047, 2048],
  protein: [1003],
  carbs: [1005],
  sugar: [2000, 1063],
  fat: [1004],
  fiber: [1079],
  sodiumMg: [1093],
};

// Into the app's food shape: nutrients per 100 g, plus the USDA's usual
// portion (often "1 cup") as one serving.
function toFood(f) {
  const byId = new Map((f.foodNutrients || []).map((n) => [n.nutrientId, n.value]));
  const get = (ids) => {
    for (const id of ids) if (byId.has(id)) return byId.get(id);
    return null;
  };
  const kcal = get(NUTRIENT_IDS.kcal);
  if (kcal == null) return null;
  const sodium = get(NUTRIENT_IDS.sodiumMg);
  const measures = (f.foodMeasures || [])
    .filter((m) => m.gramWeight > 0 && m.disseminationText && !/not specified/i.test(m.disseminationText))
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const portion = measures.find((m) => /^1 cup\b/i.test(m.disseminationText)) || measures[0];
  const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
  return {
    name: f.description,
    brand: null,
    barcode: null,
    usdaId: f.fdcId,
    basis: "per100g",
    servingGrams: portion ? portion.gramWeight : null,
    servingLabel: portion ? portion.disseminationText : null,
    source: "usda",
    nutrients: {
      kcal: Math.round(kcal),
      protein: r1(get(NUTRIENT_IDS.protein)),
      carbs: r1(get(NUTRIENT_IDS.carbs)),
      sugar: r1(get(NUTRIENT_IDS.sugar)),
      fat: r1(get(NUTRIENT_IDS.fat)),
      fiber: r1(get(NUTRIENT_IDS.fiber)),
      salt: sodium == null ? null : r1((sodium * 2.5) / 1000),
    },
  };
}

export async function GET(request) {
  const raw = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100);
  const q = raw ? tidy(raw) : "";
  if (!q) return Response.json({ foods: [] });
  try {
    // Every word first, so "macaroni and cheese" doesn't bring back cheese
    // spread. If that finds nothing, any of the words.
    let r = await ask(q, true);
    if (r.foods && r.foods.length === 0) r = await ask(q, false);
    if (r.busy) return Response.json({ error: "busy" }, { status: 503 });
    if (r.failed) return Response.json({ error: "failed" }, { status: 502 });
    return Response.json({ foods: r.foods.map(toFood).filter(Boolean) });
  } catch {
    return Response.json({ error: "failed" }, { status: 502 });
  }
}
