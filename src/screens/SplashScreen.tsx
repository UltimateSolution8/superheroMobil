import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AuthStackParamList } from '../navigation/types';
import { theme } from '../ui/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const t = setTimeout(() => {
      navigation.replace('Onboarding');
    }, 1200);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]} />
      <View style={styles.center}>
        <Image source={require('../assets/superheroo-logo.png')} style={styles.logo} />
        <Text style={styles.title}>Superheroo</Text>
        <Text style={styles.tagline}>Tap. Create. Relax.</Text>
      </View>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: { height: 90, backgroundColor: theme.colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: { width: 180, height: 180, borderRadius: 48 },
  title: { fontSize: 26, fontWeight: '900', color: theme.colors.text },
  tagline: { color: theme.colors.muted, fontWeight: '700' },
  footer: { height: 40 },
});
