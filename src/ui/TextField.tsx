import React, { memo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { theme } from './theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  secureTextEntry?: boolean;
  autoFocus?: boolean;
  multiline?: boolean;
};

export const TextField = memo(function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoFocus,
  multiline,
}: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused ? styles.inputFocused : null, multiline ? styles.inputMultiline : null]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    fontSize: 11,
    color: theme.colors.muted,
    letterSpacing: 0.35,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: theme.colors.text,
    backgroundColor: theme.colors.inputBg,
    fontSize: 15,
    lineHeight: 20,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.card,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
