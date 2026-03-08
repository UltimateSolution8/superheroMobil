import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../../auth/AuthContext';
import { useI18n } from '../../i18n/I18nProvider';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { TextField } from '../../ui/TextField';
import { theme } from '../../ui/theme';
import type { BuyerStackParamList, HelperStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BuyerStackParamList & HelperStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { lang, setLang } = useI18n();
  const { signOut, pinRequired, setPin, clearPin } = useAuth();
  const [pin, setPinValue] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const canSetPin = useMemo(() => pin.trim().length === 4, [pin]);

  const submitPin = async () => {
    if (!canSetPin) return;
    try {
      setPinError(null);
      await setPin(pin.trim());
      setPinValue('');
    } catch {
      setPinError('PIN must be 4 digits.');
    }
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.h1}>Settings</Text>
        <Text onPress={() => navigation.goBack()} style={styles.link}>
          Back
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Language</Text>
        <Segmented
          value={lang}
          onChange={(v) => setLang(v as 'en' | 'hi' | 'te')}
          options={[
            { key: 'en', label: 'EN' },
            { key: 'hi', label: 'हिं' },
            { key: 'te', label: 'తెల' },
          ]}
        />
        <PrimaryButton label="Sign out" variant="danger" onPress={signOut} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>App PIN</Text>
        <TextField
          label="4-digit PIN"
          value={pin}
          onChangeText={(t) => setPinValue(t.replace(/[^0-9]/g, '').slice(0, 4))}
          placeholder="••••"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
        />
        {pinError ? <Text style={styles.error}>{pinError}</Text> : null}
        <PrimaryButton label="Set PIN" onPress={submitPin} disabled={!canSetPin} />
        {pinRequired ? <PrimaryButton label="Remove PIN" variant="ghost" onPress={clearPin} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  link: { color: theme.colors.primary, fontWeight: '800' },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  label: { color: theme.colors.muted, fontSize: 12, fontWeight: '800' },
  error: { color: theme.colors.danger, fontWeight: '700' },
});
