import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from './theme';

type Option = { key: string; label: string };

export const Segmented = memo(function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}) {
  const onPress = useCallback(
    (k: string) => () => {
      onChange(k);
    },
    [onChange],
  );

  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={onPress(o.key)}
            style={[styles.item, active ? styles.itemActive : null]}
          >
            <Text style={[styles.label, active ? styles.labelActive : null]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceSoft,
    padding: 4,
  },
  item: {
    flex: 1,
    height: 40,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActive: {
    backgroundColor: theme.colors.primary,
    ...theme.shadow.card,
  },
  label: {
    fontWeight: '700',
    color: theme.colors.text,
    fontSize: 13,
  },
  labelActive: {
    color: theme.colors.primaryText,
  },
});
