import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from './theme';
import { ActiveTaskBubble } from './ActiveTaskBubble';

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = React.useContext(BottomTabBarHeightContext) ?? 0;
  const tabBarCompensation = Math.max(0, tabBarHeight - insets.bottom);
  return (
    <SafeAreaView style={styles.safe}>
      <View pointerEvents="none" style={styles.bgLayer}>
        <View style={styles.bgOrbTop} />
        <View style={styles.bgOrbBottom} />
      </View>
      <View style={[styles.inner, style, { paddingBottom: theme.space.lg + insets.bottom + tabBarCompensation }]}>
        {children}
        <ActiveTaskBubble />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  bgLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  bgOrbTop: {
    position: 'absolute',
    right: -80,
    top: -70,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: theme.colors.glow,
  },
  bgOrbBottom: {
    position: 'absolute',
    left: -100,
    bottom: -100,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: theme.colors.glow,
    opacity: 0.6,
  },
  inner: {
    flex: 1,
    padding: theme.space.lg,
    gap: theme.space.md,
  },
});
