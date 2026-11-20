"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Bottom tabs. Hidden while a workout is running so nothing gets tapped by accident.
export default function TabBar() {
  const path = usePathname();
  if (/^\/workouts\/.+/.test(path) || path.startsWith("/login")) return null;
  const tab = (href, label, also = []) => {
    const on = path === href || also.some((p) => path.startsWith(p));
    return (
      <Link href={href} className={`tab ${on ? "on" : ""}`}>
        {label}
      </Link>
    );
  };
  return (
    <nav className="tabbar">
      {tab("/", "Stopwatch")}
      {tab("/workouts", "Workouts")}
      {tab("/food", "Food")}
      {tab("/today", "Today", ["/profile"])}
      {tab("/plan", "Plan")}
    </nav>
  );
}
