"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Bottom tabs. Hidden while a workout is running so nothing gets tapped by accident.
export default function TabBar() {
  const path = usePathname();
  if (/^\/workouts\/.+/.test(path)) return null;
  const tab = (href, label) => (
    <Link href={href} className={`tab ${path === href ? "on" : ""}`}>
      {label}
    </Link>
  );
  return (
    <nav className="tabbar">
      {tab("/", "Stopwatch")}
      {tab("/workouts", "Workouts")}
    </nav>
  );
}
