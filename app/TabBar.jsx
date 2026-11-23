"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Bottom tabs. Hidden while a workout is running so nothing gets tapped by accident.
const ICONS = {
  today: (
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
  ),
  plan: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  food: (
    <>
      <path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M9 3v6" />
      <path d="M17 21V3c-2.2 1.2-3 3.5-3 6.5V14h3" />
    </>
  ),
  train: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4l2.5 2M10 3h4M12 3v3" />
    </>
  ),
};

export default function TabBar() {
  const path = usePathname();
  if (/^\/workouts\/.+/.test(path) || path.startsWith("/login")) return null;
  const tab = (href, label, icon, also = []) => {
    const on = path === href || also.some((p) => path.startsWith(p));
    return (
      <Link href={href} className={`tab ${on ? "on" : ""}`} aria-current={on ? "page" : undefined}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {ICONS[icon]}
        </svg>
        <span>{label}</span>
      </Link>
    );
  };
  return (
    <nav className="tabbar">
      {tab("/today", "Today", "today", ["/profile"])}
      {tab("/plan", "Plan", "plan")}
      {tab("/food", "Food", "food")}
      {tab("/workouts", "Train", "train", ["/stopwatch"])}
    </nav>
  );
}
