import { APP_VARIANT } from '../config';

export type ResolvedThemeMode = 'light' | 'dark';

const primaryColor = APP_VARIANT === 'helper' ? '#0F766E' : '#1E3A8A';
const accentColor = APP_VARIANT === 'helper' ? '#34D399' : '#60A5FA';

function buildTheme(mode: ResolvedThemeMode) {
  const dark = mode === 'dark';
  return {
    colors: {
      bg: dark ? '#0B1220' : '#F8FAFC',
      card: dark ? '#111A2C' : '#FFFFFF',
      text: dark ? '#E2E8F0' : '#0F172A',
      muted: dark ? '#94A3B8' : '#475569',
      border: dark ? '#23324D' : '#E2E8F0',
      primary: primaryColor,
      primaryText: '#FFFFFF',
      accent: accentColor,
      danger: '#EF4444',
      success: '#10B981',
      warning: '#F59E0B',
      inputBg: dark ? '#0F172A' : '#F9FBFF',
      surfaceSoft: dark ? '#1A2640' : '#EEF2FF',
    },
    radius: {
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
    },
    space: {
      xs: 6,
      sm: 10,
      md: 16,
      lg: 22,
      xl: 28,
    },
    shadow: {
      card: {
        shadowColor: dark ? '#000000' : '#0F172A',
        shadowOpacity: dark ? 0.22 : 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      },
    },
    mode,
  };
}

const baseTheme = buildTheme('light');
export const theme = baseTheme;

export function setRuntimeThemeMode(mode: ResolvedThemeMode) {
  const next = buildTheme(mode);
  Object.assign(theme, next);
}
