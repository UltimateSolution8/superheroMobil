import React, { memo, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { theme } from './theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'accent' | 'danger' | 'ghost';
  style?: ViewStyle;
  leftIcon?: React.ReactNode;
};

export const PrimaryButton = memo(function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
  leftIcon,
}: Props) {
  const colors = useMemo(() => {
    if (variant === 'accent') return { bg: theme.colors.accent, text: theme.colors.primary };
    if (variant === 'danger') return { bg: theme.colors.danger, text: theme.colors.primaryText };
    if (variant === 'ghost') return { bg: theme.colors.card, text: theme.colors.primary };
    return { bg: theme.colors.primary, text: theme.colors.primaryText };
  }, [variant]);

  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'ghost' ? styles.ghost : null,
        variant === 'primary' || variant === 'accent' ? styles.primaryShadow : styles.ghostShadow,
        {
          backgroundColor: colors.bg,
          opacity: isDisabled ? 0.55 : pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.982 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.content} pointerEvents="none">
          {leftIcon ? <View style={styles.iconWrap}>{leftIcon}</View> : null}
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ghostShadow: {
    ...theme.shadow.card,
  },
  primaryShadow: {
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  label: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
