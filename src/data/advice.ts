// The bottleneck diagnosis in words (ROADMAP.md 4.8). Each case has the gap, stated with its
// numbers, and the fixes, shown behind the "?" (so the player gets the puzzle first, the answer
// on request). Picked by diagnose() in src/sim/lines.ts. Placeholders: {name} the stage, {pct} a
// share of the day, {item} what a machine waits for, {src} where that comes from, {dst} where an
// arm drops, {need} the sparks a grid is short, {n} a count, {s} a plural s, {have} / {can} rates
// per day, {more} how many more plants, {crop} the crop's name, {takes} what a machine takes.
// Every fix named here is something the player can build or do today.

export interface Advice {
  gap: string;
  fix: string;
}

export const ADVICE: Record<string, Advice> = {
  'power:none': {
    gap: 'The {name} had no power {pct}% of the time.',
    fix: 'Put a pole within reach of it and wire the pole to a generator.',
  },
  'power:brownout': {
    gap: 'The {name} ran at {pct}% speed: the grid is {need} sparks short.',
    fix: 'Add a generator, or switch off {n} machine{s} at a pole (run the mill at night).',
  },
  needsfuel: {
    gap: 'The {name} was out of fuel {pct}% of the time.',
    fix: 'An arm from a chest of coal or wood keeps it burning.',
  },
  field: {
    gap: 'The {crop} field gives {have}/day; the {name} can use {can}.',
    fix: 'Grow about {more} more {crop} plants within a picker\'s reach (a gleaner reaches 8, a crane 48), or feed the {name} from a chest as well.',
  },
  'slow:arm': {
    gap: 'The {name} is flat out ({pct}% of the time) and what it feeds still waits: it can use {can}/min, one arm moves about 40.',
    fix: 'Wind it (right-click), add a second arm, or use a Brass Arm.',
  },
  'slow:arm-out': {
    gap: 'The {name} is flat out ({pct}% of the time) and the {src} still piles up: it makes {can}/min, one arm moves about 40.',
    fix: 'Wind it (right-click), add a second arm out of the {src}, or use a Brass Arm.',
  },
  'starved:chest': {
    gap: 'The {name} waited for {item} {pct}% of the time: the {src} it draws from ran dry.',
    fix: 'Fill the {src} faster, or give the {name} a second source.',
  },
  'starved:chest-other': {
    gap: 'The {name} waited for {item} {pct}% of the time: the {src} it draws from has none.',
    fix: 'Put {item} in the {src}, or check the arm\'s filter.',
  },
  'wrong:arm': {
    gap: 'The {name} can\'t use {item}, and the {src} it draws from has nothing else for it.',
    fix: 'The {name} takes {takes}. Put some in the {src}, or send the {item} to a machine that uses it.',
  },
  'wrong:belt': {
    gap: 'The {name} can\'t use {item}, and one sits at the end of the belt, so nothing behind it gets through.',
    fix: 'Pick the {item} off the belt (the {name} takes {takes}), then keep it off with a filtering splitter or an arm filter where the belt is loaded.',
  },
  'starved:drill': {
    gap: 'The {name} waited for {item} {pct}% of the time: one drill can\'t keep up.',
    fix: 'Add a second drill on the vein, or a chest of ore beside the line.',
  },
  'starved:machine': {
    gap: 'The {name} waited for {item} {pct}% of the time: the {src} upstream is slower.',
    fix: 'A second {src} doubles the supply.',
  },
  'starved:none': {
    gap: 'Nothing feeds the {name} ({pct}% of the time waiting).',
    fix: 'Aim an arm at it from a chest, or end a belt at it.',
  },
  'starved:shared': {
    gap: '{n} machines share one {src}, so the {name} waited for {item} {pct}% of the time.',
    fix: 'Fill the {src} faster, or give each machine its own source.',
  },
  'blocked:shipbin': {
    gap: 'The crate was full {pct}% of the time: the post can\'t keep up.',
    fix: 'Ship more kinds, add a second crate, or put a chest before it.',
  },
  'blocked:chest': {
    gap: 'The {name} was full {pct}% of the time.',
    fix: 'Empty it, add a second chest, or send its goods on with an arm.',
  },
  'blocked:machine': {
    gap: 'The {name}\'s output was full {pct}% of the time: nothing takes its goods away.',
    fix: 'Aim an arm out of it at a chest or the crate.',
  },
  'blocked:belt': {
    gap: 'The belt backed up {pct}% of the time: whatever is at its end takes nothing more.',
    fix: 'Give its end somewhere to deliver: a chest, a second machine, a splitter.',
  },
  'blocked:arm': {
    gap: 'The {name} couldn\'t drop {pct}% of the time: the {dst} in front of it is full or won\'t take it.',
    fix: 'Empty the {dst}, or point the arm somewhere that takes its goods.',
  },
  ok: {
    gap: 'Every stage keeps up. The slowest is the {name} ({have}).',
    fix: 'A second {name} doubles the line, if its supply keeps up.',
  },
  'ok:plain': {
    gap: 'Every stage keeps up: {have} arrive here.',
    fix: 'Feed it more, or build a second line beside it.',
  },
  empty: {
    gap: 'Nothing has arrived here yet today.',
    fix: 'Aim an arm or a belt at it.',
  },
};

const fill = (t: string, vars: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/** Fill an advice case; an unknown key falls back to a plain statement, never an empty line. */
export function adviceText(key: string, vars: Record<string, string | number>): { gap: string; fix: string } {
  const a = ADVICE[key] ?? ADVICE[key.split(':')[0]] ?? { gap: 'The {name} is stuck.', fix: 'Hover it to see what it waits for.' };
  return { gap: fill(a.gap, vars), fix: fill(a.fix, vars) };
}
