import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from './theme';

export const Notice = memo(function Notice({
  kind = 'info',
  text,
  onClose,
}: {
  kind?: 'info' | 'danger' | 'success' | 'warning';
  text: string;
  onClose?: () => void;
}) {
  const accent = useMemo(() => {
    if (kind === 'danger') return '#ef4444';
    if (kind === 'success') return '#10b981';
    if (kind === 'warning') return '#f59e0b';
    return '#2563eb';
  }, [kind]);

  const bg = useMemo(() => {
    if (kind === 'danger') return 'rgba(239,68,68,0.12)';
    if (kind === 'success') return 'rgba(16,185,129,0.12)';
    if (kind === 'warning') return 'rgba(245,158,11,0.12)';
    return 'rgba(37,99,235,0.10)';
  }, [kind]);

  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <View style={[styles.accentRail, { backgroundColor: `${accent}33` }]} />
      <Text style={[styles.text, { flex: 1 }]}>{text}</Text>
      {onClose ? (
        <Text
          onPress={onClose}
          style={{ paddingLeft: 8, fontSize: 18, fontWeight: '700', color: theme.colors.muted }}
        >
          ×
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 0,
    borderRadius: 14,
    paddingHorizontal: theme.space.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 1,
  },
  accentRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  text: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
