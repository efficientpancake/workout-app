"use client";

import { supabaseBrowser, authConfigured } from "./supabase";

// One place for all saved data. With the Supabase keys set, everything is
// saved to Supabase (backed up, private to the signed-in user). Without them
// (localhost before setup), it's saved in this browser only, so testing never
// touches real data.
export const usingCloud = authConfigured;

const LOCAL_KEY = "fgf-local-db-v1";
const EMPTY = { profile: null, food: [], favorites: [], meals: [], plan: [], shopping: [] };

function readLocal() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(LOCAL_KEY) || "null") };
  } catch {
    return { ...EMPTY };
  }
}

function writeLocal(d) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(d));
  } catch {}
}

const sb = () => supabaseBrowser();

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// Today's date in your own time zone, as YYYY-MM-DD.
export function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---- Profile ----

export async function getProfile() {
  if (!usingCloud) return readLocal().profile;
  return check(await sb().from("profiles").select("*").maybeSingle());
}

export async function saveProfile(profile) {
  if (!usingCloud) {
    const d = readLocal();
    d.profile = { ...profile };
    writeLocal(d);
    return d.profile;
  }
  const {
    data: { user },
  } = await sb().auth.getUser();
  const row = { ...profile, user_id: user.id, updated_at: new Date().toISOString() };
  return check(await sb().from("profiles").upsert(row).select().single());
}

// ---- Food log ----

export async function listFood(date) {
  if (!usingCloud) {
    return readLocal()
      .food.filter((f) => f.eaten_on === date)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return check(
    await sb().from("food_entries").select("*").eq("eaten_on", date).order("created_at")
  );
}

export async function addFood(entry) {
  if (!usingCloud) {
    const d = readLocal();
    const row = { ...entry, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    d.food.push(row);
    writeLocal(d);
    return row;
  }
  return check(await sb().from("food_entries").insert(entry).select().single());
}

export async function deleteFood(id) {
  if (!usingCloud) {
    const d = readLocal();
    d.food = d.food.filter((f) => f.id !== id);
    writeLocal(d);
    return;
  }
  check(await sb().from("food_entries").delete().eq("id", id));
}

// Calories logged per day between two dates (inclusive), for the coach's
// weekly average and logging streak. Returns { "YYYY-MM-DD": calories }.
export async function caloriesByDay(from, to) {
  let rows;
  if (!usingCloud) {
    rows = readLocal().food.filter((f) => f.eaten_on >= from && f.eaten_on <= to);
  } else {
    rows = check(
      await sb().from("food_entries").select("eaten_on, calories").gte("eaten_on", from).lte("eaten_on", to)
    );
  }
  const out = {};
  for (const r of rows) out[r.eaten_on] = (out[r.eaten_on] || 0) + (Number(r.calories) || 0);
  return out;
}

// One key per food, so the same product is recognized in recents and favorites.
export function foodKey(food) {
  if (food.mealId) return `meal:${food.mealId}`;
  return food.barcode || `${food.name}|${food.brand || ""}`.toLowerCase();
}

// ---- Favorites ----

export async function listFavorites() {
  if (!usingCloud) return [...readLocal().favorites].sort((a, b) => a.food.name.localeCompare(b.food.name));
  const rows = check(await sb().from("favorites").select("*"));
  return rows.sort((a, b) => a.food.name.localeCompare(b.food.name));
}

export async function addFavorite(food, amount, unit) {
  if (!usingCloud) {
    const d = readLocal();
    const row = { id: crypto.randomUUID(), food, amount, unit, created_at: new Date().toISOString() };
    d.favorites = d.favorites.filter((f) => foodKey(f.food) !== foodKey(food)).concat(row);
    writeLocal(d);
    return row;
  }
  return check(await sb().from("favorites").insert({ food, amount, unit }).select().single());
}

export async function removeFavorite(id) {
  if (!usingCloud) {
    const d = readLocal();
    d.favorites = d.favorites.filter((f) => f.id !== id);
    writeLocal(d);
    return;
  }
  check(await sb().from("favorites").delete().eq("id", id));
}

// The foods you've logged lately, newest first, one per food, with the
// amount you used last time. For one-tap re-adding.
export async function recentFoods(limit = 25) {
  let rows;
  if (!usingCloud) {
    rows = [...readLocal().food].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 200);
  } else {
    rows = check(
      await sb()
        .from("food_entries")
        .select("food, amount, unit, created_at")
        .order("created_at", { ascending: false })
        .limit(200)
    );
  }
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const k = foodKey(r.food);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ food: r.food, amount: r.amount, unit: r.unit });
    if (out.length >= limit) break;
  }
  return out;
}

// ---- Meals, weekly plan, shopping list ----
// Small helpers so each table works the same way locally and in the cloud.

const newRow = (row) => ({ ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() });

async function insertRows(table, localKey, rows) {
  if (!usingCloud) {
    const d = readLocal();
    const made = rows.map(newRow);
    d[localKey].push(...made);
    writeLocal(d);
    return made;
  }
  return check(await sb().from(table).insert(rows).select());
}

async function updateRow(table, localKey, id, patch) {
  if (!usingCloud) {
    const d = readLocal();
    d[localKey] = d[localKey].map((r) => (r.id === id ? { ...r, ...patch } : r));
    writeLocal(d);
    return d[localKey].find((r) => r.id === id);
  }
  return check(await sb().from(table).update(patch).eq("id", id).select().single());
}

async function deleteRows(table, localKey, ids) {
  if (!ids.length) return;
  if (!usingCloud) {
    const d = readLocal();
    d[localKey] = d[localKey].filter((r) => !ids.includes(r.id));
    writeLocal(d);
    return;
  }
  check(await sb().from(table).delete().in("id", ids));
}

export async function listMeals() {
  const rows = usingCloud ? check(await sb().from("meals").select("*")) : [...readLocal().meals];
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// Saves a new meal, or updates it if it has an id.
export async function saveMeal({ id, name, servings, items }) {
  const row = { name, servings, items };
  if (id) return updateRow("meals", "meals", id, row);
  return (await insertRows("meals", "meals", [row]))[0];
}

// Deleting a meal also takes it off the plan.
export async function deleteMeal(id) {
  if (!usingCloud) {
    const d = readLocal();
    d.plan = d.plan.filter((p) => p.meal_id !== id);
    writeLocal(d);
  }
  return deleteRows("meals", "meals", [id]);
}

export async function listPlan(from, to) {
  const rows = usingCloud
    ? check(await sb().from("plan_items").select("*").gte("plan_on", from).lte("plan_on", to))
    : readLocal().plan.filter((p) => p.plan_on >= from && p.plan_on <= to);
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export const addPlanItem = async (item) => (await insertRows("plan_items", "plan", [item]))[0];
export const updatePlanItem = (id, patch) => updateRow("plan_items", "plan", id, patch);
export const deletePlanItem = (id) => deleteRows("plan_items", "plan", [id]);

export async function listShopping() {
  const rows = usingCloud ? check(await sb().from("shopping_items").select("*")) : [...readLocal().shopping];
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export const addShopping = (rows) => insertRows("shopping_items", "shopping", rows);
export const updateShopping = (id, patch) => updateRow("shopping_items", "shopping", id, patch);
export const deleteShopping = (ids) => deleteRows("shopping_items", "shopping", ids);

export async function signOut() {
  if (usingCloud) await sb().auth.signOut();
  window.location.replace("/login");
}
