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
import { useI18n } from '../i18n/I18nProvider';

type Props = NativeStackScreenProps<AuthStackParamList, 'EmailLogin'>;

export function EmailLoginScreen({ navigation }: Props) {
  const { loginWithPassword } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLogin = useMemo(() => email.trim().length >= 3 && password.trim().length >= 6, [email, password]);

  const onLogin = useCallback(async () => {
    if (!canLogin || busy) return;
    setBusy(true);
    setError(null);
    try {
      await loginWithPassword(email.trim(), password);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('Could not sign in. Check your network and try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, canLogin, email, loginWithPassword, password]);

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.kav}>
        <View style={styles.header}>
          <Text style={styles.h1}>{t('email.sign_in')}</Text>
          <Text style={styles.sub}>{t('email.subtitle')}</Text>
          <Text onPress={() => navigation.goBack()} style={styles.link}>{t('email.back')}</Text>
        </View>

        <Notice kind="warning" text="Demo creds: buyer1@helpinminutes.app / Buyer@12345, helper.approved@helpinminutes.app / Helper@12345" />

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="buyer1@helpinminutes.app"
          keyboardType="default"
        />

        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
        />

        {error ? <Notice kind="danger" text={error} /> : null}

        <PrimaryButton label={t('email.sign_in')} onPress={onLogin} disabled={!canLogin} loading={busy} />
        <View style={styles.signupRow}>
          <Text onPress={() => navigation.navigate('BuyerSignup')} style={styles.link}>
            {t('login.create_account_buyer')}
          </Text>
          <Text onPress={() => navigation.navigate('HelperSignup')} style={styles.link}>
            {t('login.create_account_helper')}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'space-between' },
  header: { gap: 10, paddingTop: 8 },
  h1: { color: theme.colors.text, fontSize: 28, fontWeight: '900', letterSpacing: 0.3 },
  sub: { color: theme.colors.muted, fontSize: 13, lineHeight: 18 },
  link: { color: theme.colors.primary, fontWeight: '800' },
  signupRow: { gap: 6, alignItems: 'center', paddingBottom: 6 },
});
