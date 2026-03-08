import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { Screen } from '../../ui/Screen';
import { TextField } from '../../ui/TextField';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { theme } from '../../ui/theme';

export function PinLockScreen() {
  const { verifyPin } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => pin.trim().length === 4, [pin]);

  const unlock = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyPin(pin.trim());
      if (!ok) {
        setError('Incorrect PIN.');
      }
    } catch {
      setError('Could not verify PIN.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Enter PIN</Text>
        <Text style={styles.subtitle}>Unlock Superheroo to continue.</Text>
        <TextField
          label="4-digit PIN"
          value={pin}
          onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
          placeholder="••••"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={busy ? 'Unlocking…' : 'Unlock'} onPress={unlock} disabled={!canSubmit || busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.md,
    ...theme.shadow.card,
  },
  title: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  subtitle: { color: theme.colors.muted, fontSize: 12 },
  error: { color: theme.colors.danger, fontWeight: '700' },
});
