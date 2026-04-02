import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as api from '../../api/client';
import type { BatchItem, BatchSummary } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import type { BuyerStackParamList } from '../../navigation/types';
import { MenuButton } from '../../ui/MenuButton';
import { Notice } from '../../ui/Notice';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Screen } from '../../ui/Screen';
import { theme } from '../../ui/theme';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<BuyerStackParamList, 'BuyerBulkRequest'>;

function statusColor(status: string) {
  switch ((status || '').toUpperCase()) {
    case 'ASSIGNED':
      return '#1d4ed8';
    case 'ARRIVED':
      return '#4f46e5';
    case 'STARTED':
      return '#9333ea';
    case 'COMPLETED':
      return '#059669';
    case 'CANCELLED':
    case 'FAILED':
      return '#dc2626';
    default:
      return theme.colors.muted;
  }
}

export function BuyerBulkRequestScreen({ route, navigation }: Props) {
  const { batchId } = route.params;
  const { withAuth } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [s, list] = await withAuth(async (at) => {
        const [sum, its] = await Promise.all([api.getBatchSummary(at, batchId), api.getBatchItems(at, batchId)]);
        return [sum, its] as const;
      });
      setSummary(s);
      setItems(list || []);
    } catch {
      setError(t('bulk.track_load_failed'));
    } finally {
      setBusy(false);
    }
  }, [batchId, t, withAuth]);

  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load]),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      load();
    }, 7000);
    return () => clearInterval(timer);
  }, [load]);

  const counts = useMemo(() => summary?.byTaskStatus || {}, [summary?.byTaskStatus]);
  const acceptedCount = (counts.ASSIGNED || 0) + (counts.ARRIVED || 0) + (counts.STARTED || 0) + (counts.COMPLETED || 0);

  return (
    <Screen>
      <View style={styles.topBar}>
        <MenuButton onPress={() => navigation.navigate('Menu')} />
        <Text style={styles.h1}>{t('bulk.track_title')}</Text>
        <Text onPress={() => navigation.goBack()} style={styles.link}>{t('common.back')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? <Notice kind="danger" text={error} /> : null}
        <View style={styles.card}>
          <Text style={styles.title}>{summary?.title || '-'}</Text>
          <Text style={styles.meta}>Batch ID: {batchId}</Text>
          <Text style={styles.meta}>
            {t('bulk.helpers_accepted').replace('{count}', String(acceptedCount))} / {summary?.total ?? 0}
          </Text>
          <Text style={styles.meta}>
            {t('bulk.status_breakdown')}:
            {' '}S:{counts.SEARCHING || 0} A:{counts.ASSIGNED || 0} R:{counts.ARRIVED || 0} T:{counts.STARTED || 0} C:{counts.COMPLETED || 0}
          </Text>
          <PrimaryButton label={t('task.refresh')} onPress={load} loading={busy} variant="ghost" />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>{t('bulk.helper_lines')}</Text>
          {items.length === 0 ? <Text style={styles.meta}>{t('bulk.no_rows')}</Text> : null}
          {items.map((item) => (
            <View key={item.id} style={styles.lineRow}>
              <View style={styles.lineMain}>
                <Text style={styles.lineTitle}>#{item.lineNo} {item.taskTitle || t('buyer.create_task')}</Text>
                <Text style={[styles.lineStatus, { color: statusColor(item.taskStatus || item.lineStatus) }]}>
                  {(item.taskStatus || item.lineStatus || '-').toString()}
                </Text>
                <Text style={styles.meta}>
                  {(item.helperName || '-')} {item.helperId ? `• ${item.helperId.slice(0, 8)}` : ''}
                </Text>
              </View>
              {item.taskId ? (
                <Pressable
                  style={styles.openBtn}
                  onPress={() => navigation.navigate('BuyerTask', { taskId: item.taskId as string })}
                >
                  <Text style={styles.openBtnText}>{t('bulk.open_task')}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
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
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '900' },
  meta: { color: theme.colors.muted, fontSize: 12 },
  section: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  lineRow: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: theme.colors.surfaceSoft,
    gap: 8,
  },
  lineMain: { gap: 3 },
  lineTitle: { color: theme.colors.text, fontWeight: '800' },
  lineStatus: { fontWeight: '800', fontSize: 12 },
  openBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  openBtnText: { color: theme.colors.primary, fontWeight: '800', fontSize: 12 },
});
