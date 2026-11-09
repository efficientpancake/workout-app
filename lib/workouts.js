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
