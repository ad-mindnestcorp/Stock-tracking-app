import { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { LightColors, DarkColors, type AppColors } from '@/constants/theme';

interface ThemeContextType {
  colors: AppColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: LightColors,
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();

  // null means "follow the device"; true/false means manual override
  const [manualDark, setManualDark] = useState<boolean | null>(null);

  const isDark = manualDark !== null ? manualDark : systemScheme === 'dark';
  const colors = isDark ? DarkColors : LightColors;

  const value = useMemo(
    () => ({
      colors,
      isDark,
      toggleTheme: () => setManualDark((prev) => !(prev !== null ? prev : systemScheme === 'dark')),
    }),
    [colors, isDark, systemScheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Returns the current theme colours, a dark-mode flag, and a toggle function.
 *
 * Usage:
 *   const { colors, isDark, toggleTheme } = useTheme();
 */
export const useTheme = () => useContext(ThemeContext);
