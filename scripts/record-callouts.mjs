// Records every workout callout as a small audio clip in public/callouts,
// in the Mac's British male voice (Daniel), plus index.json mapping each line
// to its file. Run on a Mac after adding or changing a workout:
//   node scripts/record-callouts.mjs
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { WORKOUTS } from "../lib/workouts.js";
import { allLines } from "../lib/callouts.js";

const dir = join(process.cwd(), "public", "callouts");
mkdirSync(dir, { recursive: true });

const lines = [...new Set(WORKOUTS.flatMap(allLines))];
const index = {};
for (const text of lines) {
  const file = `${createHash("sha1").update(text).digest("hex").slice(0, 12)}.m4a`;
  index[text] = file;
  const out = join(dir, file);
  if (existsSync(out)) continue;
  const aiff = join(dir, "tmp.aiff");
  execFileSync("say", ["-v", "Daniel", "-r", "185", "-o", aiff, text]);
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "48000", "-c", "1", aiff, out]);
  rmSync(aiff);
}

// Remove clips for lines no workout says any more.
const keep = new Set(Object.values(index));
for (const f of readdirSync(dir)) if (f.endsWith(".m4a") && !keep.has(f)) rmSync(join(dir, f));

writeFileSync(join(dir, "index.json"), JSON.stringify(index, null, 1));
console.log(`${lines.length} callouts recorded in public/callouts`);
