// Workout library. Add new workouts to the WORKOUTS array.
//
// Block types:
//  - "intervals": a fixed list of timed steps. The app calls out each step.
//      steps: [{ sec, label, say }]  (say = what the voice reads out)
//  - "circuit": one countdown for the whole block. You repeat the moves
//      until time is called.
//      sec: block length in seconds
//      moves: list of moves shown on screen
//      push: optional { sec, label } adds a "Start push" button that runs a
//            short timer inside the block (for the tread push between rows)
//      logDistance: true shows a "Rower meters" box when the block ends
//      beatBlock: index of an earlier block whose distance is the target
//      finisher: optional { sec, label } takes over the last `sec` seconds
//
// Steps can also have a `note` (smaller text under the label).
// Workout-level `transitionSec`: timed break between blocks that starts the
// next block on its own. Without it, the app waits for you to tap Start.

// Turns 90 into "1 minute 30", 60 into "1 minute", 45 into "45 seconds".
function spoken(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return `${s} seconds`;
  const mins = `${m} minute${m > 1 ? "s" : ""}`;
  return s ? `${mins} ${s}` : mins;
}

// A timed step. The voice says the time and the label unless `say` is given.
function step(sec, label, extra = {}) {
  return { sec, label, say: `${spoken(sec)}. ${label}.`, ...extra };
}

function finisher(sec, label) {
  return { sec, label, say: `Finisher. ${spoken(sec)}. ${label}.` };
}

const push15 = { sec: 15, label: "Push to all out", say: "15 seconds. Push, building to all out." };
const push45 = { sec: 45, label: "Push", say: "45 seconds. Push pace." };
const walk30 = { sec: 30, label: "Walk recovery", say: "30 seconds. Walk recovery." };
const allOut30 = { sec: 30, label: "All out", say: "30 seconds. All out. Empty the tank." };

const rowTreadMoves = [
  "20 stroke push row",
  "Move to the treadmill",
  "30 second push",
  "Move back to the rower",
];

export const WORKOUTS = [
  {
    id: "power-row-run",
    name: "Power Row + Run",
    focus: "Power",
    blocks: [
      {
        type: "circuit",
        title: "Row / Tread Block 1",
        sec: 300,
        intro: "Row and tread block 1. 5 minutes. 20 stroke push row, then a 30 second push on the tread. Repeat until time.",
        moves: rowTreadMoves,
        push: { sec: 30, label: "Tread push" },
        logDistance: true,
      },
      {
        type: "intervals",
        title: "Tread Block 2",
        intro: "Tread block 2. Pushes and walk recoveries.",
        steps: [push15, push45, walk30, push15, push45, walk30, push15, push45],
      },
      {
        type: "circuit",
        title: "Row / Tread Block 3",
        sec: 300,
        intro: "Row and tread block 3. 5 minutes. Match or beat your rower distance from block 1.",
        moves: rowTreadMoves,
        push: { sec: 30, label: "Tread push" },
        logDistance: true,
        beatBlock: 0,
      },
      {
        type: "intervals",
        title: "Tread Block 4",
        intro: "Tread block 4. Three rounds, then a 30 second all out to finish.",
        steps: [push15, push45, walk30, push15, push45, walk30, push15, push45, walk30, allOut30],
      },
      {
        type: "circuit",
        title: "Floor Block 1",
        sec: 300,
        intro: "Floor block 1. 5 minute circuit.",
        moves: [
          "12 total: high plank alternating wide step with power",
          "6 each: forward lunge with chop",
          "6 each: high plank lateral reach",
        ],
      },
    ],
  },

  {
    id: "tornado-1",
    name: "Tornado 1",
    focus: "Tread, row, floor rotation",
    transitionSec: 90,
    blocks: [
      {
        type: "intervals",
        title: "Tread Block 1",
        steps: [step(240, "Base or push", { say: "4 minutes. Base or push, your call." }), step(60, "All out")],
      },
      {
        type: "circuit",
        title: "Row Block 1",
        sec: 300,
        moves: [
          "400 meter row",
          "8 jump squats",
          "12 alternating reverse lunges",
          "16 high knees",
          "Row for distance until time",
        ],
      },
      {
        type: "circuit",
        title: "Floor Block 1",
        sec: 300,
        moves: [
          "10 burpees",
          "8 hammer curls",
          "8 push press",
          "8 TRX low row (explosive)",
          "8 alternating up/down plank",
          "Sit-up with alternating rotation until time",
        ],
      },
      {
        type: "intervals",
        title: "Tread Block 2",
        steps: [step(180, "Push"), step(60, "All out")],
      },
      {
        type: "circuit",
        title: "Row Block 2",
        sec: 240,
        moves: [
          "200 meter row",
          "8 jump squats",
          "12 alternating reverse lunges",
          "16 high knees",
          "Row for distance until time",
        ],
      },
      {
        type: "circuit",
        title: "Floor Block 2",
        sec: 240,
        moves: [
          "5 burpees",
          "8 hammer curls",
          "8 push press",
          "8 TRX low row (explosive)",
          "8 alternating up/down plank",
          "Sit-up with alternating rotation until time",
        ],
      },
      {
        type: "intervals",
        title: "Tread Block 3",
        steps: [step(120, "Push to all out"), step(60, "All out")],
      },
      {
        type: "circuit",
        title: "Row Block 3",
        sec: 180,
        moves: ["8 jump squats", "12 alternating reverse lunges", "16 high knees", "Row for distance"],
        finisher: finisher(60, "All out row"),
      },
      {
        type: "circuit",
        title: "Floor Block 3",
        sec: 180,
        moves: [
          "8 hammer curls",
          "8 push press",
          "8 TRX low row (explosive)",
          "8 alternating up/down plank",
          "Sit-up with alternating rotation until time",
        ],
        finisher: finisher(60, "Low plank hold"),
      },
    ],
  },

  {
    id: "tornado-2",
    name: "Tornado 2",
    focus: "Floor, tread, row rotation",
    blocks: [
      {
        type: "circuit",
        title: "Block 1: Floor",
        sec: 300,
        moves: ["8 hammer curls", "8 front-loaded squats", "8 shoulder presses", "8 low rows", "Rest"],
      },
      {
        type: "intervals",
        title: "Block 1: Tread",
        steps: [step(180, "Push"), step(60, "Base"), step(60, "All out")],
      },
      {
        type: "intervals",
        title: "Block 1: Row",
        steps: [step(180, "Push row"), step(60, "Base row"), step(60, "All out row")],
      },
      {
        type: "circuit",
        title: "Block 2: Floor",
        sec: 240,
        moves: ["6 to 10 chest press", "Rest", "6 to 10 alternating side lunges", "Rest"],
      },
      {
        type: "intervals",
        title: "Block 2: Tread",
        steps: [
          step(60, "Base", { note: "4% incline", say: "1 minute. Base, 4 percent incline." }),
          step(60, "Base", { note: "3% incline", say: "1 minute. Base, 3 percent incline." }),
          step(60, "Base", { note: "2% incline", say: "1 minute. Base, 2 percent incline." }),
          step(60, "All out"),
        ],
      },
      {
        type: "intervals",
        title: "Block 2: Row",
        steps: [step(180, "Base row"), step(60, "All out row")],
      },
      {
        type: "intervals",
        title: "Block 3: Floor",
        steps: [
          step(60, "Push-ups + sit-ups", {
            note: "8 tricep push-ups, 8 sprinter sit-ups, low plank until time",
            say: "1 minute. 8 tricep push-ups, 8 sprinter sit-ups, then low plank until time.",
          }),
          step(60, "Sprinter sit-ups", {
            note: "8 reps",
            say: "1 minute. 8 sprinter sit-ups.",
          }),
          step(60, "Sit-ups + push-ups", {
            note: "8 sprinter sit-ups, 8 tricep push-ups, low plank until time",
            say: "1 minute. 8 sprinter sit-ups, 8 tricep push-ups, then low plank until time.",
          }),
        ],
      },
      {
        type: "intervals",
        title: "Block 3: Tread",
        steps: [step(60, "All out"), step(60, "Walk recovery"), step(60, "All out"), step(60, "Walk recovery")],
      },
      {
        type: "intervals",
        title: "Block 3: Row",
        steps: [step(60, "All out row"), step(60, "Rest"), step(60, "All out row"), step(60, "Rest")],
      },
    ],
  },

  {
    id: "tornado-3",
    name: "Tornado 3",
    focus: "Tread, row, floor rotation",
    blocks: [
      {
        type: "intervals",
        title: "Tread Block 1",
        steps: [step(90, "Push"), step(30, "Base"), step(30, "Push"), step(60, "All out")],
      },
      {
        type: "circuit",
        title: "Row Block 1",
        sec: 210,
        moves: [
          "400 meter push row",
          "3 sets: 8 squat jumps + 16 lateral hops",
          "Bonus: row for distance until time",
        ],
      },
      {
        type: "circuit",
        title: "Floor Block 1",
        sec: 210,
        moves: [
          "10 squat to press",
          "10 total TRX reverse lunge jumps",
          "10 TRX high row",
          "Rest",
          "Bonus: torso rotation until time",
        ],
      },
      {
        type: "intervals",
        title: "Tread Block 2",
        steps: [step(90, "Push"), step(45, "Base"), step(45, "Push"), step(60, "All out")],
      },
      {
        type: "circuit",
        title: "Row Block 2",
        sec: 240,
        moves: [
          "500 meter push row",
          "2 sets: 8 squat jumps + 16 lateral hops",
          "Bonus: row for distance until time",
        ],
      },
      {
        type: "circuit",
        title: "Floor Block 2",
        sec: 240,
        moves: [
          "8 squat to press",
          "8 total TRX reverse lunge jumps",
          "8 TRX high row",
          "Rest",
          "8 total high plank to low plank",
          "Bonus: torso rotation until time",
        ],
      },
      {
        type: "intervals",
        title: "Tread Block 3",
        steps: [step(90, "Push"), step(60, "Base"), step(60, "Push"), step(60, "All out")],
      },
      {
        type: "circuit",
        title: "Row Block 3",
        sec: 270,
        moves: ["600 meter push row", "1 set: 8 squat jumps + 16 lateral hops"],
        finisher: finisher(60, "All out row"),
      },
      {
        type: "circuit",
        title: "Floor Block 3",
        sec: 270,
        moves: [
          "6 squat to press",
          "6 total TRX reverse lunge jumps",
          "6 TRX high row",
          "Rest",
          "6 total high plank to low plank",
          "6 bridge hold dumbbell pullover",
        ],
        finisher: finisher(60, "Sprinter sit-ups"),
      },
    ],
  },
];

export function getWorkout(id) {
  return WORKOUTS.find((w) => w.id === id);
}

export function blockSeconds(block) {
  return block.type === "circuit" ? block.sec : block.steps.reduce((a, s) => a + s.sec, 0);
}

export function workoutSeconds(workout) {
  return workout.blocks.reduce((a, b) => a + blockSeconds(b), 0);
}
