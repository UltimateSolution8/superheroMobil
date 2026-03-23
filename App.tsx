import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/auth/AuthContext';
import { I18nProvider } from './src/i18n/I18nProvider';
import { Sentry } from './src/monitoring/sentry';
import { applyThemeFromStorage, resolveThemePreference } from './src/ui/themePreference';
import { theme } from './src/ui/theme';

function App() {
  const [Navigator, setNavigator] = useState<React.ComponentType | null>(null);
  const [statusBarStyle, setStatusBarStyle] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const pref = await applyThemeFromStorage();
      const resolved = resolveThemePreference(pref);
      if (!mounted) return;
      setStatusBarStyle(resolved === 'dark' ? 'light' : 'dark');
      const mod = await import('./src/navigation/AppNavigator');
      if (!mounted) return;
      setNavigator(() => mod.AppNavigator);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <StatusBar style={statusBarStyle} />
          {Navigator ? (
            <Navigator />
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          )}
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Sentry.wrap(App);
