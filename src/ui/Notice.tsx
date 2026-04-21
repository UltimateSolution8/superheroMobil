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
  const bg = useMemo(() => {
    if (kind === 'danger') return 'rgba(239,68,68,0.12)';
    if (kind === 'success') return 'rgba(16,185,129,0.12)';
    if (kind === 'warning') return 'rgba(245,158,11,0.12)';
    return 'rgba(37,99,235,0.10)';
  }, [kind]);

  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
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
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 1,
  },
  text: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
