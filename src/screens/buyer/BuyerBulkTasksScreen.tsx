import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as api from '../../api/client';
import type { BatchCreateItem, BatchPreviewItemResult } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import type { BuyerStackParamList } from '../../navigation/types';
import { Screen } from '../../ui/Screen';
import { Notice } from '../../ui/Notice';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { TextField } from '../../ui/TextField';
import { theme } from '../../ui/theme';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<BuyerStackParamList, 'BuyerBulkTasks'>;

const SAMPLE_CSV = [
  'title,description,urgency,timeMinutes,budgetPaise,lat,lng,addressText,scheduledAt,externalRef,priority',
  '"AC repair","Split AC not cooling in hall",HIGH,90,120000,17.4376,78.4482,"Madhapur, Hyderabad",,SITE-001,2',
  '"Deep cleaning","Kitchen and bathroom deep cleaning",NORMAL,120,180000,17.4916,78.3995,"Kukatpally, Hyderabad",,SITE-002,3',
].join('\n');

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function toNum(v: string, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function csvToItems(content: string): BatchCreateItem[] {
  const rows = content.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  if (rows.length < 2) return [];
  const head = parseCsvLine(rows[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => head.indexOf(name.toLowerCase());
  return rows.slice(1).map((row) => {
    const cells = parseCsvLine(row);
    const get = (name: string) => {
      const i = idx(name);
      return i >= 0 ? cells[i] ?? '' : '';
    };
    return {
      title: get('title'),
      description: get('description'),
      urgency: ((get('urgency') || 'NORMAL').toUpperCase() as BatchCreateItem['urgency']),
      timeMinutes: toNum(get('timeMinutes'), 30),
      budgetPaise: toNum(get('budgetPaise'), 0),
      lat: toNum(get('lat')),
      lng: toNum(get('lng')),
      addressText: get('addressText') || null,
      scheduledAt: get('scheduledAt') || null,
      externalRef: get('externalRef') || null,
      priority: toNum(get('priority'), 3),
    };
  });
}

export function BuyerBulkTasksScreen({ navigation }: Props) {
  const { withAuth } = useAuth();
  const { t } = useI18n();
  const [title, setTitle] = useState('My Bulk Batch');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<BatchCreateItem[]>([]);
  const [preview, setPreview] = useState<BatchPreviewItemResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onImportCsv = useCallback(async () => {
    setError(null);
    setNotice(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    try {
      const res = await fetch(asset.uri);
      const text = await res.text();
      const lines = csvToItems(text);
      if (!lines.length) {
        setError(t('bulk.no_rows'));
        return;
      }
      setItems(lines);
      setNotice(t('bulk.csv_loaded').replace('{count}', String(lines.length)));
    } catch {
      setError(t('bulk.csv_failed'));
    }
  }, [t]);

  const onDownloadSample = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      const fileUri = `${dir}superheroo-bulk-sample.csv`;
      await FileSystem.writeAsStringAsync(fileUri, SAMPLE_CSV, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Sample CSV' });
      }
      setNotice(t('bulk.sample_ready'));
    } catch {
      setError(t('bulk.csv_failed'));
    }
  }, [t]);

  const onPreview = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!items.length) {
      setError(t('bulk.no_rows'));
      return;
    }
    setBusy(true);
    try {
      const res = await withAuth((at) => api.previewBatch(at, items));
      setPreview(res.items || []);
      setNotice(t('bulk.preview_ready'));
    } catch {
      setError(t('bulk.preview_failed'));
    } finally {
      setBusy(false);
    }
  }, [items, t, withAuth]);

  const onCreate = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!items.length) {
      setError(t('bulk.no_rows'));
      return;
    }
    if (!title.trim()) {
      setError(t('bulk.title_required'));
      return;
    }
    setBusy(true);
    try {
      const result = await withAuth((at) =>
        api.createBatch(at, {
          title: title.trim(),
          notes: notes.trim() || null,
          idempotencyKey: `buyer-bulk-${Date.now()}`,
          items,
        }),
      );
      setNotice(
        t('bulk.created_summary')
          .replace('{created}', String(result.createdCount))
          .replace('{failed}', String(result.failedCount))
          .replace('{batchId}', result.batchId),
      );
      navigation.navigate('History');
    } catch {
      setError(t('bulk.create_failed'));
    } finally {
      setBusy(false);
    }
  }, [items, navigation, notes, t, title, withAuth]);

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text onPress={() => (navigation.canGoBack() ? navigation.goBack() : (navigation as any).navigate('BuyerTabs', { screen: 'BuyerLanding' }))} style={styles.link}>
          {t('common.back')}
        </Text>
        <Text style={styles.h1}>{t('bulk.title')}</Text>
        <Text onPress={() => navigation.navigate('SupportTickets')} style={styles.link}>{t('buyer.support')}</Text>
      </View>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {error ? <Notice kind="danger" text={error} /> : null}
          {notice ? <Notice kind="success" text={notice} /> : null}

          <View style={styles.card}>
            <TextField label={t('bulk.batch_name')} value={title} onChangeText={setTitle} />
            <TextField label={t('bulk.notes')} value={notes} onChangeText={setNotes} />
            <View style={styles.row}>
              <PrimaryButton label={t('bulk.import_csv')} onPress={onImportCsv} variant="ghost" style={styles.half} />
              <PrimaryButton label={t('bulk.download_sample')} onPress={onDownloadSample} variant="ghost" style={styles.half} />
            </View>
            <Text style={styles.hint}>{t('bulk.csv_header')}</Text>
            <Text style={styles.hint}>{t('bulk.rows_loaded').replace('{count}', String(items.length))}</Text>
            <View style={styles.row}>
              <PrimaryButton label={t('bulk.preview')} onPress={onPreview} loading={busy} variant="ghost" style={styles.half} />
              <PrimaryButton label={t('bulk.create_batch')} onPress={onCreate} loading={busy} style={styles.half} />
            </View>
          </View>

          {preview.length ? (
            <View style={styles.card}>
              <Text style={styles.section}>{t('bulk.preview_results')}</Text>
              {preview.slice(0, 20).map((p) => (
                <Text key={`line-${p.lineNo}`} style={styles.previewLine}>
                  #{p.lineNo} · {t('bulk.recommended').replace('{amount}', String(Math.round((p.recommendedBudgetPaise || 0) / 100)))} · {p.confidence}
                  {p.errors?.length ? ` · ${p.errors.join('; ')}` : ''}
                </Text>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
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
  section: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  hint: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', gap: theme.space.sm },
  half: { flex: 1 },
  previewLine: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
});
