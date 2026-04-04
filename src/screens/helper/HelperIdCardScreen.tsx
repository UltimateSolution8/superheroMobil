import React, { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as api from '../../api/client';
import type { HelperIdCard } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import type { HelperStackParamList } from '../../navigation/types';
import { Notice } from '../../ui/Notice';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Screen } from '../../ui/Screen';
import { theme } from '../../ui/theme';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<HelperStackParamList, 'HelperIdCard'>;

export function HelperIdCardScreen({ navigation }: Props) {
  const { withAuth } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<HelperIdCard | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await withAuth((at) => api.helperIdCard(at));
      setCard(result);
    } catch {
      setError(t('error.network_check'));
    } finally {
      setBusy(false);
    }
  }, [t, withAuth]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text onPress={() => (navigation.canGoBack() ? navigation.goBack() : (navigation as any).navigate('HelperTabs', { screen: 'HelperLanding' }))} style={styles.link}>
          {t('common.back')}
        </Text>
        <Text style={styles.h1}>{t('id_card.title')}</Text>
        <Text onPress={() => navigation.navigate('SupportTickets')} style={styles.link}>{t('buyer.support')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? <Notice kind="danger" text={error} /> : null}
        <View style={styles.idShell}>
          <View style={styles.idHeader}>
            <Text style={styles.brand}>SUPERHEROOO</Text>
            <Text style={styles.badgeId}>{card?.badgeId || '-'}</Text>
          </View>
          <View style={styles.identityRow}>
            {card?.selfieUrl ? <Image source={{ uri: card.selfieUrl }} style={styles.selfie} resizeMode="cover" /> : <View style={styles.selfiePlaceholder} />}
            <View style={styles.identityMain}>
              <Text style={styles.name}>{card?.fullName || '-'}</Text>
              <Text style={styles.metaStrong}>{t('id_card.kyc_status')}: {card?.kycStatus || '-'}</Text>
              <Text style={styles.meta}>{t('id_card.phone')}: {card?.phone || '-'}</Text>
            </View>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.meta}>{t('id_card.id_masked')}: {card?.idNumberMasked || '-'}</Text>
            <Text style={styles.meta}>
            {t('id_card.issued_at')}: {card?.issuedAt ? new Date(card.issuedAt).toLocaleString() : '-'}
            </Text>
          </View>
        </View>
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
  idShell: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.sm,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  idHeader: {
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  identityRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6 },
  identityMain: { flex: 1, gap: 4 },
  brand: { color: theme.colors.primary, fontWeight: '900', letterSpacing: 0.7 },
  badgeId: { color: theme.colors.text, fontWeight: '800' },
  selfie: {
    width: 92,
    height: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selfiePlaceholder: {
    width: 92,
    height: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSoft,
  },
  name: { color: theme.colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  metaBox: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 10,
    gap: 4,
  },
  metaStrong: { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
  meta: { color: theme.colors.muted, fontSize: 13 },
});
