import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { palette, type Colors, type ThemeName } from './tokens';
import { useSettings } from '@/store/settings';

type ThemeValue = {
  name: ThemeName;
  c: Colors;
  reducedMotion: boolean;
  fontsReady: boolean;
};

const ThemeContext = createContext<ThemeValue>({
  name: 'dark',
  c: palette.dark,
  reducedMotion: false,
  fontsReady: false,
});

export function ThemeProvider({
  children,
  fontsReady = false,
}: {
  children: React.ReactNode;
  fontsReady?: boolean;
}) {
  const preference = useSettings((s) => s.theme);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const system = useColorScheme();

  const value = useMemo<ThemeValue>(() => {
    // Dark is the product default (DESIGN.md 3.2). "System" is an opt-in that
    // follows the OS; every other value wins outright.
    const name: ThemeName =
      preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
    return { name, c: palette[name], reducedMotion, fontsReady };
  }, [preference, system, reducedMotion, fontsReady]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Shorthand for the common case of only needing colours. */
export function useColors(): Colors {
  return useContext(ThemeContext).c;
}
