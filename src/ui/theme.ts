import { APP_VARIANT } from '../config';

export type ResolvedThemeMode = 'light' | 'dark';

const primaryColor = APP_VARIANT === 'helper' ? '#0F766E' : '#1E3A8A';
const accentColor = APP_VARIANT === 'helper' ? '#34D399' : '#60A5FA';

function buildTheme(mode: ResolvedThemeMode) {
  const dark = mode === 'dark';
  return {
    colors: {
      bg: dark ? '#0A1222' : '#F4F7FB',
      card: dark ? '#111B30' : '#FFFFFF',
      text: dark ? '#E2E8F0' : '#0F172A',
      muted: dark ? '#9EB0CA' : '#53627B',
      border: dark ? '#2D3F62' : '#DCE5F1',
      primary: primaryColor,
      primaryText: '#FFFFFF',
      accent: accentColor,
      danger: '#EF4444',
      success: '#10B981',
      warning: '#F59E0B',
      inputBg: dark ? '#101B32' : '#F9FBFF',
      surfaceSoft: dark ? '#162540' : '#ECF2FF',
      dangerSoft: dark ? '#4A1D1F' : '#FEE2E2',
      dangerBorder: dark ? '#7F1D1D' : '#FECACA',
      overlay: dark ? 'rgba(2, 6, 23, 0.78)' : 'rgba(15, 23, 42, 0.35)',
      skeleton: dark ? '#23324D' : '#E2E8F0',
    },
    radius: {
      sm: 10,
      md: 14,
      lg: 18,
      xl: 24,
    },
    space: {
      xs: 8,
      sm: 12,
      md: 16,
      lg: 24,
      xl: 32,
    },
    shadow: {
      card: {
        shadowColor: dark ? '#000000' : '#0F172A',
        shadowOpacity: dark ? 0.28 : 0.12,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 4,
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
