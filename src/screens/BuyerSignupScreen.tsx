import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { Screen } from '../ui/Screen';
import { PrimaryButton } from '../ui/PrimaryButton';
import { TextField } from '../ui/TextField';
import { Notice } from '../ui/Notice';
import { theme } from '../ui/theme';
import type { AuthStackParamList } from '../navigation/types';
import { ApiError } from '../api/http';

type Props = NativeStackScreenProps<AuthStackParamList, 'BuyerSignup'>;

export function BuyerSignupScreen({ navigation }: Props) {
  const { signupWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => email.includes('@') && password.trim().length >= 6, [email, password]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signupWithPassword(email.trim(), password.trim(), 'BUYER', phone.trim() || null, displayName.trim() || null);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message || `Signup failed (${e.status})`);
      } else {
        setError('Could not create account. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, canSubmit, displayName, email, password, phone, signupWithPassword]);

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.kav}>
        <View style={styles.header}>
          <Text style={styles.h1}>Sign up</Text>
          <Text style={styles.sub}>Create a buyer account with email and password.</Text>
        </View>

        <View style={styles.form}>
          <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Min 6 characters"
            secureTextEntry
          />
          <TextField
            label="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
          />
          <TextField
            label="Display name (optional)"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ravi"
          />
        </View>

        {error ? <Notice kind="danger" text={error} /> : null}

        <View style={styles.footer}>
          <PrimaryButton label="Sign up" onPress={onSubmit} disabled={!canSubmit} loading={busy} />
          <Text onPress={() => navigation.goBack()} style={styles.alt}>
            Back to login
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'space-between' },
  header: { gap: 10, paddingTop: 8 },
  h1: { color: theme.colors.text, fontSize: 26, fontWeight: '900', letterSpacing: 0.2 },
  sub: { color: theme.colors.muted, fontSize: 14, lineHeight: 20 },
  form: { gap: 12 },
  footer: { gap: 12, paddingBottom: 6 },
  alt: { color: theme.colors.primary, fontWeight: '800', textAlign: 'center', paddingVertical: 4 },
});
