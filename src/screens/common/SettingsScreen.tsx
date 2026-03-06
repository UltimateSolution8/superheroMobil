import React, { useState } from 'react';
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

  const handleSetPin = async () => {
    if (pin.trim().length !== 4) {
      setPinError('PIN must be 4 digits.');
      return;
    }
    setPinError(null);
    await setPin(pin.trim());
    setPinValue('');
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
        <View style={styles.divider} />
        <Text style={styles.label}>4-digit PIN</Text>
        <Text style={styles.helperText}>
          {pinRequired ? 'PIN is enabled for quick login.' : 'Set a PIN for fast sign-in.'}
        </Text>
        <TextField
          label="PIN"
          value={pin}
          onChangeText={(v) => setPinValue(v.replace(/\D+/g, '').slice(0, 4))}
          keyboardType="number-pad"
          placeholder="••••"
        />
        {pinError ? <Text style={styles.error}>{pinError}</Text> : null}
        <View style={styles.row}>
          <PrimaryButton label="Set PIN" onPress={handleSetPin} style={styles.half} />
          <PrimaryButton label="Remove PIN" onPress={clearPin} variant="ghost" style={styles.half} />
        </View>
        <PrimaryButton label="Sign out" variant="danger" onPress={signOut} />
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
  helperText: { color: theme.colors.muted, fontSize: 12 },
  error: { color: theme.colors.danger, fontWeight: '700' },
  divider: { height: 1, backgroundColor: theme.colors.border },
  row: { flexDirection: 'row', gap: theme.space.sm },
  half: { flex: 1 },
});
