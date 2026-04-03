import React, { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as api from '../../api/client';
import type { HelperIdCard } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import type { BuyerStackParamList } from '../../navigation/types';
import { Notice } from '../../ui/Notice';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Screen } from '../../ui/Screen';
import { theme } from '../../ui/theme';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<BuyerStackParamList, 'BuyerHelperIdCard'>;

export function BuyerHelperIdCardScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const { withAuth } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<HelperIdCard | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await withAuth((at) => api.taskHelperIdCard(at, taskId));
      setCard(result);
    } catch {
      setError(t('id_card.unavailable'));
    } finally {
      setBusy(false);
    }
  }, [t, taskId, withAuth]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text onPress={() => (navigation.canGoBack() ? navigation.goBack() : (navigation as any).navigate('BuyerTabs', { screen: 'BuyerLanding' }))} style={styles.link}>
          {t('common.back')}
        </Text>
        <Text style={styles.h1}>{t('id_card.title')}</Text>
        <Text onPress={() => navigation.navigate('SupportTickets')} style={styles.link}>{t('buyer.support')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? <Notice kind="warning" text={error} /> : null}
        {card ? (
          <View style={styles.card}>
            <View style={styles.badgeRow}>
              <Text style={styles.brand}>SUPERHEROOO</Text>
              <Text style={styles.badgeId}>{card.badgeId}</Text>
            </View>
            {card.selfieUrl ? <Image source={{ uri: card.selfieUrl }} style={styles.selfie} resizeMode="cover" /> : null}
            <Text style={styles.name}>{card.fullName}</Text>
            <Text style={styles.meta}>{t('id_card.phone')}: {card.phone || '-'}</Text>
            <Text style={styles.meta}>{t('id_card.kyc_status')}: {card.kycStatus}</Text>
            <Text style={styles.meta}>{t('id_card.id_masked')}: {card.idNumberMasked || '-'}</Text>
          </View>
        ) : null}
        <PrimaryButton label={t('task.refresh')} onPress={load} loading={busy} variant="ghost" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  link: { color: theme.colors.primary, fontWeight: '800' },
  scroll: { gap: theme.space.md, paddingBottom: theme.space.xl },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: theme.colors.primary, fontWeight: '900', letterSpacing: 0.6 },
  badgeId: { color: theme.colors.muted, fontWeight: '700' },
  selfie: {
    width: 108,
    height: 108,
    borderRadius: 12,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  name: { color: theme.colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  meta: { color: theme.colors.muted, fontSize: 13 },
});
