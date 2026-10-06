/** Persistent Focus Desk state (per-browser, localStorage). */
export interface CardState {
  id: number;
  title: string;
  column: number; // 0 = To do, 1 = Doing, 2 = Done
}

export type GrowthKind = 'focus' | 'task';

export interface DeskState {
  version: 1;
  cards: CardState[];
  nextId: number;
  presetIndex: number;
  minutes: number;
  onboarded: boolean;
  /** yyyy-mm-dd -> counts */
  days: Record<string, { focus: number; tasks: number }>;
  /** Most recent growth events, oldest first. */
  garden: { kind: GrowthKind; day: string }[];
}

const KEY = 'focus-desk-v1';
export const GARDEN_SLOTS = 18;

export const TASK_PRESETS = [
  'Plan the day',
  'Reply to emails',
  'Deep work block',
  'Review a pull request',
  'Stretch for 2 min',
  'Drink water',
  'Read 10 pages',
  'Tidy the desk',
  'Call a friend',
  "Write tomorrow's top 3",
];

export const DURATIONS = [1, 5, 15, 25];

export function today(d = new Date()): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function defaults(): DeskState {
  return {
    version: 1,
    cards: [
      { id: 1, title: 'Plan the day', column: 0 },
      { id: 2, title: 'Deep work block', column: 0 },
      { id: 3, title: 'Stretch for 2 min', column: 0 },
    ],
    nextId: 4,
    presetIndex: 3,
    minutes: 25,
    onboarded: false,
    days: {},
    garden: [],
  };
}

export function loadState(): DeskState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeskState;
      if (parsed?.version === 1 && Array.isArray(parsed.cards)) {
        return { ...defaults(), ...parsed };
      }
    }
  } catch {
    /* storage unavailable: fall back to defaults */
  }
  return defaults();
}

export function saveState(state: DeskState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function recordGrowth(state: DeskState, kind: GrowthKind): void {
  const d = today();
  const entry = state.days[d] ?? { focus: 0, tasks: 0 };
  if (kind === 'focus') entry.focus++;
  else entry.tasks++;
  state.days[d] = entry;
  state.garden.push({ kind, day: d });
  if (state.garden.length > GARDEN_SLOTS) {
    state.garden.splice(0, state.garden.length - GARDEN_SLOTS);
  }
}

/** Consecutive days (ending today, or yesterday if today is empty) with growth. */
export function streak(state: DeskState): number {
  let count = 0;
  const cursor = new Date();
  const has = (d: Date) => {
    const e = state.days[today(d)];
    return !!e && e.focus + e.tasks > 0;
  };
  if (!has(cursor)) cursor.setDate(cursor.getDate() - 1);
  while (has(cursor)) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}
