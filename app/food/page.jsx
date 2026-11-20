"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FoodPicker from "./FoodPicker";
import { addFood, listMeals, localDate } from "../../lib/db";
import { mealToFood } from "../../lib/meals";

// Add food to a day: scan, search, your meals, favorites, recent, or type it in.
export default function Food() {
  const [date, setDate] = useState(null);
  const [meals, setMeals] = useState([]);

  useEffect(() => {
    setDate(new URLSearchParams(window.location.search).get("date") || localDate());
    listMeals().then(setMeals).catch(() => {});
  }, []);

  if (!date) return <main className="screen form-screen" />;

  const isToday = date === localDate();
  const dayLabel = isToday
    ? "today"
    : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  const mealList = meals.length
    ? [{ title: "Your meals", items: meals.map((m) => ({ food: mealToFood(m), amount: 1, unit: "serving" })) }]
    : [];

  return (
    <main className="screen form-screen">
      <FoodPicker
        title="Add food"
        subtitle={`Adding to ${dayLabel}`}
        extraLists={mealList}
        onSave={({ food, amount, unit, totals }) => addFood({ eaten_on: date, food, amount, unit, ...totals })}
        doneLink={<Link href={isToday ? "/today" : `/today?date=${date}`}>See {isToday ? "today" : "that day"}</Link>}
      />
    </main>
  );
}
