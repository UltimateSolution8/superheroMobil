import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from './theme';

export const Notice = memo(function Notice({
  kind = 'info',
  text,
}: {
  kind?: 'info' | 'danger' | 'success' | 'warning';
  text: string;
}) {
  const bg = useMemo(() => {
    if (kind === 'danger') return 'rgba(239,68,68,0.12)';
    if (kind === 'success') return 'rgba(16,185,129,0.12)';
    if (kind === 'warning') return 'rgba(245,158,11,0.12)';
    return 'rgba(37,99,235,0.10)';
  }, [kind]);

  const border = useMemo(() => {
    if (kind === 'danger') return 'rgba(239,68,68,0.35)';
    if (kind === 'success') return 'rgba(16,185,129,0.35)';
    if (kind === 'warning') return 'rgba(245,158,11,0.35)';
    return 'rgba(37,99,235,0.35)';
  }, [kind]);

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderColor: border }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  text: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
