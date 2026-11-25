// Every line the workout voice says, in one place. The workout screen uses
// these, and scripts/record-callouts.mjs records each one as an audio clip
// (iPhone lets recorded clips play over your music; its live voice stops it).

export const LINES = {
  getSet: "10 seconds. Get set.",
  finisherSoon: "Finisher in 10 seconds.",
  oneMinute: "One minute left.",
  thirty: "30 seconds left.",
  backToRower: "Back to the rower.",
};

const introOf = (b) => b.intro ?? `${b.title}.`;

export function goLine(block) {
  if (block.type === "intervals") return block.steps[0].say;
  const mins = block.sec / 60;
  return `Go. ${Number.isInteger(mins) ? mins : mins.toFixed(1)} minutes.`;
}

export const pushLine = (block) => `Push. ${block.push.sec} seconds.`;

// What the voice says when a block ends: what's next, or that you're done.
export function endLine(workout, block, next) {
  const check = block.logDistance ? "Check your rower distance. " : "";
  if (!next) return `Time. ${check}Workout done. Nice work.`;
  const when = workout.transitionSec ? `${workout.transitionSec} seconds to get set.` : "Tap start when ready.";
  return `Time. ${check}Next up, ${introOf(next)} ${when}`;
}

// Everything one workout can say.
export function allLines(workout) {
  const out = new Set(Object.values(LINES));
  workout.blocks.forEach((b, i) => {
    out.add(goLine(b));
    out.add(endLine(workout, b, workout.blocks[i + 1]));
    if (b.type === "intervals") b.steps.forEach((s) => s.say && out.add(s.say));
    if (b.finisher?.say) out.add(b.finisher.say);
    if (b.push) out.add(pushLine(b));
  });
  return [...out];
}
