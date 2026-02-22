import React, { useCallback } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AuthStackParamList } from '../navigation/types';
import { Screen } from '../ui/Screen';
import { PrimaryButton } from '../ui/PrimaryButton';
import { Segmented } from '../ui/Segmented';
import { theme } from '../ui/theme';
import { useI18n } from '../i18n/I18nProvider';

type Props = NativeStackScreenProps<AuthStackParamList, 'RoleSelection'>;

export function RoleSelectionScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useI18n();

  const goBuyer = useCallback(() => {
    navigation.navigate('Login', { role: 'BUYER' });
  }, [navigation]);

  const goHelper = useCallback(() => {
    navigation.navigate('Login', { role: 'HELPER' });
  }, [navigation]);

  return (
    <Screen style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <Segmented
          value={lang}
          onChange={(v) => setLang(v as 'en' | 'hi' | 'te')}
          options={[
            { key: 'en', label: 'EN' },
            { key: 'hi', label: 'हिं' },
            { key: 'te', label: 'తెల' },
          ]}
        />
      </View>

      <View style={styles.brand}>
        <Image source={require('../../assets/superheroo-logo.png')} style={styles.logo} />
        <Text style={styles.title}>{t('app.name')}</Text>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>{t('role.title')}</Text>
        <Text style={styles.sub}>{t('role.subtitle')}</Text>
        <View style={styles.actions}>
          <PrimaryButton label={t('role.book')} onPress={goBuyer} variant="accent" style={styles.bigBtn} />
          <PrimaryButton label={t('role.be')} onPress={goHelper} style={styles.bigBtn} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: theme.space.lg },
  header: { alignItems: 'flex-start' },
  brand: { alignItems: 'center', gap: 8 },
  logo: { width: 90, height: 90, borderRadius: 24 },
  title: { fontSize: 26, fontWeight: '900', color: theme.colors.text },
  tagline: { color: theme.colors.muted, fontWeight: '700' },
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space.lg,
    gap: theme.space.md,
    ...theme.shadow.card,
  },
  heading: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  sub: { color: theme.colors.muted, lineHeight: 20 },
  actions: { gap: theme.space.sm, marginTop: 4 },
  bigBtn: { height: 54, borderRadius: 18 },
});
