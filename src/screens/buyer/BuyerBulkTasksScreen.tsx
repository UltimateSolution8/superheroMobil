import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as api from '../../api/client';
import type { BatchCreateItem, BatchPreviewItemResult } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import type { BuyerStackParamList } from '../../navigation/types';
import { Screen } from '../../ui/Screen';
import { MenuButton } from '../../ui/MenuButton';
import { Notice } from '../../ui/Notice';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { TextField } from '../../ui/TextField';
import { theme } from '../../ui/theme';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<BuyerStackParamList, 'BuyerBulkTasks'>;

const DEFAULT_LINES = JSON.stringify(
  [
    {
      title: 'AC repair',
      description: 'Split AC not cooling in hall',
      urgency: 'HIGH',
      timeMinutes: 90,
      budgetPaise: 120000,
      lat: 12.9716,
      lng: 77.5946,
      addressText: 'MG Road, Bengaluru',
      externalRef: 'SITE-001',
      priority: 2,
    },
    {
      title: 'Deep cleaning',
      description: 'Kitchen and bathroom deep cleaning',
      urgency: 'NORMAL',
      timeMinutes: 120,
      budgetPaise: 180000,
      lat: 12.975,
      lng: 77.605,
      addressText: 'Indiranagar, Bengaluru',
      externalRef: 'SITE-002',
      priority: 3,
    },
  ],
  null,
  2,
);

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
  const [itemsText, setItemsText] = useState(DEFAULT_LINES);
  const [preview, setPreview] = useState<BatchPreviewItemResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const parsedItems = useMemo(() => {
    try {
      const parsed = JSON.parse(itemsText);
      return Array.isArray(parsed) ? (parsed as BatchCreateItem[]) : null;
    } catch {
      return null;
    }
  }, [itemsText]);

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
      setItemsText(JSON.stringify(lines, null, 2));
      setNotice(t('bulk.csv_loaded').replace('{count}', String(lines.length)));
    } catch {
      setError(t('bulk.csv_failed'));
    }
  }, [t]);

  const onPreview = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!parsedItems || !parsedItems.length) {
      setError(t('bulk.invalid_json'));
      return;
    }
    setBusy(true);
    try {
      const res = await withAuth((at) => api.previewBatch(at, parsedItems));
      setPreview(res.items || []);
      setNotice(t('bulk.preview_ready'));
    } catch {
      setError(t('bulk.preview_failed'));
    } finally {
      setBusy(false);
    }
  }, [parsedItems, t, withAuth]);

  const onCreate = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!parsedItems || !parsedItems.length) {
      setError(t('bulk.invalid_json'));
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
          items: parsedItems,
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
  }, [navigation, notes, parsedItems, t, title, withAuth]);

  return (
    <Screen>
      <View style={styles.topBar}>
        <MenuButton onPress={() => navigation.navigate('Menu')} />
        <Text style={styles.h1}>{t('bulk.title')}</Text>
        <Text onPress={() => navigation.goBack()} style={styles.link}>{t('common.back')}</Text>
      </View>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {error ? <Notice kind="danger" text={error} /> : null}
          {notice ? <Notice kind="success" text={notice} /> : null}

          <View style={styles.card}>
            <TextField label={t('bulk.batch_name')} value={title} onChangeText={setTitle} />
            <TextField label={t('bulk.notes')} value={notes} onChangeText={setNotes} />
            <PrimaryButton label={t('bulk.import_csv')} onPress={onImportCsv} variant="ghost" />
            <Text style={styles.hint}>{t('bulk.csv_header')}</Text>
            <TextField
              label={t('bulk.items_json')}
              value={itemsText}
              onChangeText={setItemsText}
              multiline
            />
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
