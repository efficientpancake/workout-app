import Link from "next/link";
import { WORKOUTS, workoutSeconds } from "../../lib/workouts";

export default function Workouts() {
  return (
    <main className="screen">
      <h1 className="run-title">Workouts</h1>
      <ul className="workout-list">
        {WORKOUTS.map((w) => (
          <li key={w.id}>
            <Link href={`/workouts/${w.id}`}>
              <span className="w-name">{w.name}</span>
              <span className="muted">
                {w.focus} · {w.blocks.length} blocks · about {Math.round(workoutSeconds(w) / 60)} min
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
