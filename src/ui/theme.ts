import { APP_VARIANT } from '../config';

export type ResolvedThemeMode = 'light' | 'dark';

const primaryColor = APP_VARIANT === 'helper' ? '#0F766E' : '#1E3A8A';
const accentColor = APP_VARIANT === 'helper' ? '#34D399' : '#60A5FA';

function buildTheme(mode: ResolvedThemeMode) {
  const dark = mode === 'dark';
  const isHelper = APP_VARIANT === 'helper';
  const lightBg = isHelper ? '#EAF7F3' : '#EEF4FF';
  const lightSurfaceSoft = isHelper ? '#DEF4EC' : '#E5EEFF';
  const lightSurfaceRaised = isHelper ? '#E5F8F1' : '#ECF3FF';
  return {
    colors: {
      bg: dark ? '#090F1D' : lightBg,
      card: dark ? '#111A2D' : '#FFFFFF',
      text: dark ? '#ECF3FF' : '#111827',
      muted: dark ? '#A9BAD5' : '#5B6B85',
      border: dark ? '#2F4368' : '#D6E0EE',
      primary: primaryColor,
      primaryText: '#FFFFFF',
      accent: accentColor,
      danger: '#EF4444',
      success: '#10B981',
      warning: '#F59E0B',
      inputBg: dark ? '#0E1A30' : '#F8FAFF',
      surfaceSoft: dark ? '#172540' : lightSurfaceSoft,
      surfaceRaised: dark ? '#1A2A47' : lightSurfaceRaised,
      dangerSoft: dark ? '#4A1D1F' : '#FEE2E2',
      dangerBorder: dark ? '#7F1D1D' : '#FECACA',
      overlay: dark ? 'rgba(2, 6, 23, 0.78)' : 'rgba(15, 23, 42, 0.35)',
      skeleton: dark ? '#23324D' : '#E2E8F0',
      glow: dark ? 'rgba(96, 165, 250, 0.20)' : 'rgba(30, 58, 138, 0.10)',
    },
    radius: {
      sm: 10,
      md: 16,
      lg: 20,
      xl: 28,
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
        shadowOpacity: dark ? 0.34 : 0.1,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4.5,
      },
      lifted: {
        shadowColor: dark ? '#000000' : '#0F172A',
        shadowOpacity: dark ? 0.42 : 0.16,
        shadowRadius: 26,
        shadowOffset: { width: 0, height: 14 },
        elevation: 8,
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
