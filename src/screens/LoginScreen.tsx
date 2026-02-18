import React, { useCallback, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { Screen } from '../ui/Screen';
import { PrimaryButton } from '../ui/PrimaryButton';
import { TextField } from '../ui/TextField';
import { Segmented } from '../ui/Segmented';
import { Notice } from '../ui/Notice';
import { theme } from '../ui/theme';
import type { AuthStackParamList } from '../navigation/types';
import { ApiError } from '../api/http';
import { API_BASE_URL, DEV_SHOW_OTP } from '../config';
import { useI18n } from '../i18n/I18nProvider';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

function normalizePhone(raw: string) {
  return raw.replace(/\\D+/g, '').slice(-10);
}

export function LoginScreen({ navigation }: Props) {
  const { startOtp } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [role, setRole] = useState<'BUYER' | 'HELPER'>('BUYER');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const canSend = useMemo(() => normalizePhone(phone).length === 10, [phone]);

  const onSend = useCallback(async () => {
    if (!canSend || busy) return;
    setBusy(true);
    setError(null);
    try {
      const p = normalizePhone(phone);
      const res = await startOtp(p, role);
      navigation.navigate('Otp', { phone: p, role, devOtp: res.devOtp ?? res.otp ?? null });
    } catch (e) {
      if (e instanceof ApiError) {
        setError(`Could not send OTP (${e.status}). Check your network and try again.`);
      } else {
        setError('Could not send OTP. Check your network and try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, canSend, navigation, phone, role, startOtp]);

  const onCheckConnection = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    setHealth(null);
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/actuator/health`, {
        signal: controller.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        setHealth(`Health check failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setHealth(data.status === 'UP' ? 'Backend reachable (UP)' : `Backend status: ${data.status}`);
    } catch (_e) {
      setHealth('Backend not reachable from this device');
    } finally {
      setChecking(false);
    }
  }, [checking]);

  const onSignup = useCallback(() => {
    navigation.navigate(role === 'BUYER' ? 'BuyerSignup' : 'HelperSignup');
  }, [navigation, role]);

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.kav}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={require('../assets/superlogo.png')} style={styles.logo} />
            <View>
              <Text style={styles.h1}>{t('app.name')}</Text>
              <Text style={styles.sub}>{t('app.tagline')}</Text>
            </View>
          </View>
        </View>

        <Segmented
          value={lang}
          onChange={(v) => setLang(v as 'en' | 'hi' | 'te')}
          options={[
            { key: 'en', label: 'EN' },
            { key: 'hi', label: 'हिं' },
            { key: 'te', label: 'తెల' },
          ]}
        />

        <Segmented
          value={role}
          onChange={(v) => setRole(v as 'BUYER' | 'HELPER')}
          options={[
            { key: 'BUYER', label: t('login.need_help') },
            { key: 'HELPER', label: t('login.can_help') },
          ]}
        />

        <TextField
          label={t('login.phone')}
          value={phone}
          onChangeText={setPhone}
          placeholder={t('login.phone_placeholder')}
          keyboardType="phone-pad"
          autoFocus
        />

        {DEV_SHOW_OTP ? (
          <Notice
            kind="warning"
            text="Dev demo numbers: Buyer=7777777777, Helper=8888888888, Admin=9999999999 (admin only works on web/admin tools)."
          />
        ) : null}

        <Notice
          kind="info"
          text={`API: ${API_BASE_URL}`}
        />

        <Text onPress={onCheckConnection} style={styles.alt}>
          {checking ? t('login.backend_checking') : t('login.backend_test')}
        </Text>

        {health ? <Notice kind={health.includes('UP') ? 'success' : 'danger'} text={health} /> : null}

        {error ? <Notice kind="danger" text={error} /> : null}

        <View style={styles.footer}>
          <PrimaryButton label={t('login.send_otp')} onPress={onSend} disabled={!canSend} loading={busy} />
          <Text onPress={() => navigation.navigate('EmailLogin')} style={styles.alt}>
            {t('login.use_email')}
          </Text>
          <Text onPress={onSignup} style={styles.alt}>
            {role === 'BUYER' ? t('login.create_account_buyer') : t('login.create_account_helper')}
          </Text>
          <Text style={styles.legal}>
            {t('login.terms')}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'space-between' },
  header: { gap: 10, paddingTop: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 14 },
  h1: { color: theme.colors.text, fontSize: 30, fontWeight: '900', letterSpacing: 0.3 },
  sub: { color: theme.colors.muted, fontSize: 14, lineHeight: 20 },
  footer: { gap: 12, paddingBottom: 6 },
  alt: { color: theme.colors.primary, fontWeight: '800', textAlign: 'center', paddingVertical: 4 },
  legal: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
});
