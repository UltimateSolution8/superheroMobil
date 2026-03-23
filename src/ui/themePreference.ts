import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

import { setRuntimeThemeMode, type ResolvedThemeMode } from './theme';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'superheroo.theme.preference';

export function resolveThemePreference(pref: ThemePreference): ResolvedThemeMode {
  if (pref === 'light' || pref === 'dark') return pref;
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

export async function getStoredThemePreference(): Promise<ThemePreference> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      return raw;
    }
  } catch {
    // no-op
  }
  return 'system';
}

export async function setStoredThemePreference(pref: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // no-op
  }
}

export async function applyThemeFromStorage(): Promise<ThemePreference> {
  const pref = await getStoredThemePreference();
  setRuntimeThemeMode(resolveThemePreference(pref));
  return pref;
}
