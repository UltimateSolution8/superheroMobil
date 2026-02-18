import React from 'react';
import { SafeAreaView, StyleSheet, View, type ViewStyle } from 'react-native';

import { theme } from './theme';

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.inner, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  inner: {
    flex: 1,
    padding: theme.space.lg,
    gap: theme.space.md,
  },
});
