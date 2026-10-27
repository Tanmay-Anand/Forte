import { create } from 'zustand';
import { sqlite } from '@/db/client';
import type { Unit } from '@/lib/format';

export type ThemePreference = 'system' | 'dark' | 'light';

type SettingsState = {
  unit: Unit;
  theme: ThemePreference;
  /** DESIGN.md 6.2 — the battery lever the timestamp architecture makes possible. */
  keepAwake: boolean;
  /** Ongoing notification with the rest stopwatch and set controls, shown on the lock screen. */
  lockScreenControls: boolean;
  reducedMotion: boolean;
  loaded: boolean;
  load: () => void;
  set: <K extends keyof Persisted>(key: K, value: Persisted[K]) => void;
};

type Persisted = Pick<
  SettingsState,
  'unit' | 'theme' | 'keepAwake' | 'lockScreenControls' | 'reducedMotion'
>;

const DEFAULTS: Persisted = {
  unit: 'kg',
  // Dark is the product default, not a system mirror. Gym lighting, evening
  // training, lower glare (DESIGN.md 3.2). "System" is available as an opt-in.
  theme: 'dark',
  keepAwake: true,
  lockScreenControls: true,
  reducedMotion: false,
};

function readAll(): Partial<Persisted> {
  const rows = sqlite.getAllSync<{ key: string; value: string }>('SELECT key, value FROM settings;');
  const out: Record<string, unknown> = {};
  for (const { key, value } of rows) {
    try {
      out[key] = JSON.parse(value);
    } catch {
      out[key] = value;
    }
  }
  return out as Partial<Persisted>;
}

function write(key: string, value: unknown): void {
  sqlite.runSync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [key, JSON.stringify(value)],
  );
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: () => {
    set({ ...DEFAULTS, ...readAll(), loaded: true });
  },

  set: (key, value) => {
    write(key, value);
    set({ [key]: value } as Pick<SettingsState, typeof key>);
    void get;
  },
}));
