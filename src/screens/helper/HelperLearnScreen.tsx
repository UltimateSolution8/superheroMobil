import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as api from '../../api/client';
import type { HelperTrainingProgress, LearningAssessment, TrainingMaterial } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import type { HelperStackParamList } from '../../navigation/types';
import { Notice } from '../../ui/Notice';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { theme } from '../../ui/theme';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<HelperStackParamList, 'HelperLearn'>;

export function HelperLearnScreen({ navigation }: Props) {
  const { withAuth } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<'materials' | 'assessments'>('materials');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [progressByMaterial, setProgressByMaterial] = useState<Record<string, HelperTrainingProgress>>({});
  const [assessments, setAssessments] = useState<LearningAssessment[]>([]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [m, p, a] = await withAuth(async (at) => Promise.all([
        api.helperLearnMaterials(at),
        api.helperLearnProgress(at),
        api.helperLearnAssessments(at),
      ]));
      setMaterials(Array.isArray(m) ? m : []);
      setAssessments(Array.isArray(a) ? a : []);
      const next: Record<string, HelperTrainingProgress> = {};
      (Array.isArray(p) ? p : []).forEach((row) => {
        if (row?.materialId) next[row.materialId] = row;
      });
      setProgressByMaterial(next);
    } catch {
      setError(t('learn.load_failed'));
    } finally {
      setBusy(false);
    }
  }, [t, withAuth]);

  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load]),
  );

  const updateProgress = useCallback(
    async (material: TrainingMaterial, targetPercent: number) => {
      setError(null);
      setNotice(null);
      try {
        const row = await withAuth((at) =>
          api.helperUpdateLearnProgress(at, material.id, {
            progressPercent: targetPercent,
            viewedSeconds: material.durationSeconds
              ? Math.round((material.durationSeconds * targetPercent) / 100)
              : undefined,
            completed: targetPercent >= 100,
          }),
        );
        setProgressByMaterial((prev) => ({ ...prev, [material.id]: row }));
        setNotice(targetPercent >= 100 ? t('learn.progress_completed') : t('learn.progress_saved'));
      } catch {
        setError(t('learn.progress_failed'));
      }
    },
    [t, withAuth],
  );

  const options = useMemo(
    () => [
      { key: 'materials', label: t('learn.tab_materials') },
      { key: 'assessments', label: t('learn.tab_assessments') },
    ],
    [t],
  );

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.h1}>{t('learn.title')}</Text>
        <Text onPress={() => navigation.goBack()} style={styles.link}>{t('common.back')}</Text>
      </View>
      {error ? <Notice kind="danger" text={error} /> : null}
      {notice ? <Notice kind="success" text={notice} /> : null}

      <Segmented options={options} value={tab} onChange={(v) => setTab(v as 'materials' | 'assessments')} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            {t('learn.helper_intro')}
          </Text>
        </View>

        {tab === 'materials' ? (
          <View style={styles.card}>
            <View style={styles.sectionTop}>
              <Text style={styles.section}>{t('learn.materials')}</Text>
              <PrimaryButton label={t('task.refresh')} onPress={load} loading={busy} variant="ghost" />
            </View>
            {materials.length === 0 ? <Text style={styles.meta}>{t('learn.empty_materials')}</Text> : null}
            {materials.map((m) => {
              const p = progressByMaterial[m.id];
              const pct = p?.progressPercent ?? 0;
              return (
                <View key={m.id} style={styles.rowCard}>
                  <Text style={styles.rowTitle}>{m.title}</Text>
                  {m.description ? <Text style={styles.meta}>{m.description}</Text> : null}
                  <Text style={styles.meta}>
                    {m.contentType} {m.durationSeconds ? `• ${Math.ceil(m.durationSeconds / 60)} ${t('helper.task.minutes')}` : ''}
                  </Text>
                  <Text style={styles.meta}>
                    {t('learn.progress')}: {pct}% {p?.status ? `• ${p.status}` : ''}
                  </Text>
                  <View style={styles.rowButtons}>
                    <PrimaryButton
                      label={t('learn.open')}
                      onPress={() => Linking.openURL(m.resourceUrl)}
                      variant="ghost"
                      style={styles.btnSmall}
                    />
                    <PrimaryButton label="25%" onPress={() => updateProgress(m, 25)} variant="ghost" style={styles.btnMini} />
                    <PrimaryButton label="50%" onPress={() => updateProgress(m, 50)} variant="ghost" style={styles.btnMini} />
                    <PrimaryButton label="75%" onPress={() => updateProgress(m, 75)} variant="ghost" style={styles.btnMini} />
                    <PrimaryButton label={t('learn.complete')} onPress={() => updateProgress(m, 100)} style={styles.btnMini} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {tab === 'assessments' ? (
          <View style={styles.card}>
            <View style={styles.sectionTop}>
              <Text style={styles.section}>{t('learn.assessments')}</Text>
              <PrimaryButton label={t('task.refresh')} onPress={load} loading={busy} variant="ghost" />
            </View>
            {assessments.length === 0 ? <Text style={styles.meta}>{t('learn.empty_assessments')}</Text> : null}
            {assessments.map((a) => (
              <View key={a.id} style={styles.rowCard}>
                <Text style={styles.rowTitle}>{a.title}</Text>
                {a.description ? <Text style={styles.meta}>{a.description}</Text> : null}
                <Text style={styles.meta}>
                  {t('learn.max_attempts')}: {a.maxAttempts} • {t('learn.pass_percentage')}: {a.passPercentage}%
                  {a.timeLimitMinutes ? ` • ${a.timeLimitMinutes} ${t('helper.task.minutes')}` : ''}
                </Text>
                <View style={styles.rowButtons}>
                  <PrimaryButton
                    label={t('learn.start_assessment')}
                    onPress={() => navigation.navigate('HelperAssessment', { assessmentId: a.id })}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}
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
  sectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  meta: { color: theme.colors.muted, fontSize: 12 },
  rowCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.colors.surfaceSoft,
    gap: 4,
  },
  rowTitle: { color: theme.colors.text, fontWeight: '800', fontSize: 14 },
  rowButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  btnSmall: { minWidth: 80 },
  btnMini: { minWidth: 56 },
  infoCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceRaised,
    padding: theme.space.md,
  },
  infoText: { color: theme.colors.muted, fontSize: 12.5, lineHeight: 18 },
});
