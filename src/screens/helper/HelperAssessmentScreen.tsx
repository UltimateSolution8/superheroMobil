import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as api from '../../api/client';
import type { HelperAssessmentAttempt, HelperAssessmentStart, LearningAssessment } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import type { HelperStackParamList } from '../../navigation/types';
import { Notice } from '../../ui/Notice';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Screen } from '../../ui/Screen';
import { TextField } from '../../ui/TextField';
import { theme } from '../../ui/theme';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<HelperStackParamList, 'HelperAssessment'>;

type OptionItem = { label: string; value: string };

function normalizeType(typeRaw: unknown): string {
  return String(typeRaw || '').trim().toLowerCase();
}

function isVisible(question: any, answers: Record<string, any>): boolean {
  const depId = typeof question?.dependsOnQuestionId === 'string' ? question.dependsOnQuestionId : null;
  if (!depId) return true;
  const depValue = answers[depId];
  if (depValue == null) return false;
  const expected = question?.dependsOnValue;
  if (Array.isArray(expected)) {
    if (Array.isArray(depValue)) {
      const got = new Set(depValue.map((v) => String(v)));
      return expected.some((v: any) => got.has(String(v)));
    }
    return expected.map((v: any) => String(v)).includes(String(depValue));
  }
  if (expected == null) return Boolean(depValue);
  return String(depValue) === String(expected);
}

function parseOptions(question: any): OptionItem[] {
  const raw = Array.isArray(question?.options) ? question.options : [];
  return raw
    .map((opt: any) => {
      if (opt && typeof opt === 'object') {
        const value = opt.value ?? opt.id ?? opt.label;
        const label = opt.label ?? opt.value ?? opt.id;
        if (value == null || label == null) return null;
        return { label: String(label), value: String(value) };
      }
      if (opt == null) return null;
      return { label: String(opt), value: String(opt) };
    })
    .filter(Boolean) as OptionItem[];
}

export function HelperAssessmentScreen({ route, navigation }: Props) {
  const { assessmentId } = route.params;
  const { withAuth } = useAuth();
  const { t } = useI18n();

  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<LearningAssessment | null>(null);
  const [attempt, setAttempt] = useState<HelperAssessmentStart | null>(null);
  const [attempts, setAttempts] = useState<HelperAssessmentAttempt[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<HelperAssessmentAttempt | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [allAssessments, allAttempts] = await withAuth(async (at) => {
        const [assessmentsList, attemptsList] = await Promise.all([
          api.helperLearnAssessments(at),
          api.helperAssessmentAttempts(at, assessmentId),
        ]);
        return [assessmentsList, attemptsList] as const;
      });
      const found = (allAssessments || []).find((a) => a.id === assessmentId) || null;
      setAssessment(found);
      setAttempts(allAttempts || []);
      const latest = (allAttempts || []).find((a) => a.status === 'IN_PROGRESS') || null;
      if (latest) {
        setAnswers((latest.answers as Record<string, any>) || {});
      }
    } catch {
      setError(t('learn.load_failed'));
    } finally {
      setBusy(false);
    }
  }, [assessmentId, t, withAuth]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleQuestions = useMemo(() => {
    const schema = Array.isArray(assessment?.questionSchema) ? assessment?.questionSchema : [];
    return schema.filter((q: any) => isVisible(q, answers));
  }, [assessment?.questionSchema, answers]);

  const startAttempt = useCallback(async () => {
    setError(null);
    setNotice(null);
    setResult(null);
    try {
      const started = await withAuth((at) => api.helperStartAssessment(at, assessmentId));
      setAttempt(started);
      setNotice(t('learn.assessment_started'));
    } catch {
      setError(t('learn.assessment_start_failed'));
    }
  }, [assessmentId, t, withAuth]);

  const submit = useCallback(async () => {
    if (!attempt) {
      setError(t('learn.start_before_submit'));
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const submitted = await withAuth((at) =>
        api.helperSubmitAssessment(at, assessmentId, {
          attemptId: attempt.attemptId,
          answers,
        }),
      );
      setResult(submitted);
      setNotice(
        submitted.status === 'PASSED'
          ? t('learn.assessment_passed')
          : submitted.status === 'FAILED'
            ? t('learn.assessment_failed')
            : t('learn.assessment_submitted'),
      );
      setAttempt(null);
      await load();
    } catch {
      setError(t('learn.assessment_submit_failed'));
    } finally {
      setSubmitting(false);
    }
  }, [answers, assessmentId, attempt, load, t, withAuth]);

  const renderQuestion = (question: any) => {
    const qId = String(question?.id || '');
    const qType = normalizeType(question?.type);
    const label = String(question?.label || qId || 'Question');
    const required = Boolean(question?.required);
    const current = answers[qId];
    const options = parseOptions(question);

    if (!qId) return null;
    if (qType === 'section') {
      return (
        <View key={qId} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{label}</Text>
        </View>
      );
    }

    if (qType === 'single_choice' || qType === 'radio') {
      return (
        <View key={qId} style={styles.qCard}>
          <Text style={styles.qLabel}>{label}{required ? ' *' : ''}</Text>
          <View style={styles.optionWrap}>
            {options.map((opt) => (
              <Pressable
                key={`${qId}-${opt.value}`}
                style={[styles.optionChip, String(current) === opt.value ? styles.optionChipActive : null]}
                onPress={() => setAnswers((prev) => ({ ...prev, [qId]: opt.value }))}
              >
                <Text style={[styles.optionText, String(current) === opt.value ? styles.optionTextActive : null]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (qType === 'multiple_choice' || qType === 'multiselect' || qType === 'checkbox') {
      const selected = Array.isArray(current) ? current.map((v) => String(v)) : [];
      return (
        <View key={qId} style={styles.qCard}>
          <Text style={styles.qLabel}>{label}{required ? ' *' : ''}</Text>
          <View style={styles.optionWrap}>
            {options.map((opt) => {
              const isOn = selected.includes(opt.value);
              return (
                <Pressable
                  key={`${qId}-${opt.value}`}
                  style={[styles.optionChip, isOn ? styles.optionChipActive : null]}
                  onPress={() => {
                    setAnswers((prev) => {
                      const list = Array.isArray(prev[qId]) ? [...prev[qId]] : [];
                      const idx = list.findIndex((v: any) => String(v) === opt.value);
                      if (idx >= 0) list.splice(idx, 1);
                      else list.push(opt.value);
                      return { ...prev, [qId]: list };
                    });
                  }}
                >
                  <Text style={[styles.optionText, isOn ? styles.optionTextActive : null]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (qType === 'boolean' || qType === 'yes_no' || qType === 'bool') {
      const boolVal = typeof current === 'boolean' ? current : String(current).toLowerCase() === 'true';
      const hasValue = current !== undefined;
      return (
        <View key={qId} style={styles.qCard}>
          <Text style={styles.qLabel}>{label}{required ? ' *' : ''}</Text>
          <View style={styles.optionWrap}>
            <Pressable
              style={[styles.optionChip, hasValue && boolVal ? styles.optionChipActive : null]}
              onPress={() => setAnswers((prev) => ({ ...prev, [qId]: true }))}
            >
              <Text style={[styles.optionText, hasValue && boolVal ? styles.optionTextActive : null]}>{t('common.yes')}</Text>
            </Pressable>
            <Pressable
              style={[styles.optionChip, hasValue && !boolVal ? styles.optionChipActive : null]}
              onPress={() => setAnswers((prev) => ({ ...prev, [qId]: false }))}
            >
              <Text style={[styles.optionText, hasValue && !boolVal ? styles.optionTextActive : null]}>{t('common.no')}</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (qType === 'rating' || qType === 'star' || qType === 'stars') {
      const ratingVal = Number(current) || 0;
      return (
        <View key={qId} style={styles.qCard}>
          <Text style={styles.qLabel}>{label}{required ? ' *' : ''}</Text>
          <View style={styles.optionWrap}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={`${qId}-star-${n}`}
                style={[styles.optionChip, ratingVal === n ? styles.optionChipActive : null]}
                onPress={() => setAnswers((prev) => ({ ...prev, [qId]: n }))}
              >
                <Text style={[styles.optionText, ratingVal === n ? styles.optionTextActive : null]}>
                  {'★'.repeat(n)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    const keyboardType =
      qType === 'number' || qType === 'numeric' || qType === 'rating'
        ? 'number-pad'
        : qType === 'email'
          ? 'email-address'
          : qType === 'url'
            ? 'url'
            : 'default';

    return (
      <View key={qId} style={styles.qCard}>
        <Text style={styles.qLabel}>{label}{required ? ' *' : ''}</Text>
        <TextField
          label=""
          value={current == null ? '' : String(current)}
          onChangeText={(text) =>
            setAnswers((prev) => ({ ...prev, [qId]: qType === 'number' || qType === 'numeric' ? Number(text || 0) : text }))
          }
          keyboardType={keyboardType as any}
          multiline={qType === 'text' || qType === 'long_text'}
        />
      </View>
    );
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.h1}>{assessment?.title || t('learn.assessment')}</Text>
        <Text onPress={() => navigation.goBack()} style={styles.link}>{t('common.back')}</Text>
      </View>
      {error ? <Notice kind="danger" text={error} /> : null}
      {notice ? <Notice kind="success" text={notice} /> : null}
      {result ? (
        <Notice
          kind={result.status === 'PASSED' ? 'success' : result.status === 'FAILED' ? 'warning' : 'info'}
          text={`${t('learn.score')}: ${result.scorePercentage ?? 0}% • ${result.correctCount ?? 0}/${result.totalCount ?? 0}`}
        />
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>{t('learn.assessment_intro')}</Text>
        </View>

        {assessment?.instructions ? (
          <View style={styles.card}>
            <Text style={styles.meta}>{assessment.instructions}</Text>
            <Text style={styles.meta}>
              {t('learn.max_attempts')}: {assessment.maxAttempts} • {t('learn.pass_percentage')}: {assessment.passPercentage}%
              {assessment.timeLimitMinutes ? ` • ${assessment.timeLimitMinutes} ${t('helper.task.minutes')}` : ''}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.actions}>
            <PrimaryButton label={t('task.refresh')} onPress={load} loading={busy} variant="ghost" style={styles.actionBtn} />
            <PrimaryButton label={t('learn.start_assessment')} onPress={startAttempt} style={styles.actionBtn} />
          </View>
          {attempt ? (
            <Text style={styles.meta}>
              {t('learn.active_attempt')}: #{attempt.attemptNo}
              {attempt.timeLimitMinutes ? ` • ${attempt.timeLimitMinutes} ${t('helper.task.minutes')}` : ''}
            </Text>
          ) : (
            <Text style={styles.meta}>{t('learn.no_active_attempt')}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>{t('learn.questions')}</Text>
          {visibleQuestions.map(renderQuestion)}
          <PrimaryButton
            label={t('learn.submit_assessment')}
            onPress={submit}
            disabled={!attempt}
            loading={submitting}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>{t('learn.past_attempts')}</Text>
          {attempts.length === 0 ? <Text style={styles.meta}>{t('learn.no_attempts')}</Text> : null}
          {attempts.map((a) => (
            <View key={a.id} style={styles.attemptRow}>
              <Text style={styles.attemptTitle}>#{a.attemptNo} • {a.status}</Text>
              <Text style={styles.meta}>
                {t('learn.score')}: {a.scorePercentage ?? 0}% • {a.correctCount ?? 0}/{a.totalCount ?? 0}
              </Text>
              <Text style={styles.meta}>{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '-'}</Text>
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
  scroll: { gap: theme.space.md, paddingBottom: theme.space.xl * 1.4 },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  section: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  meta: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1 },
  sectionCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: theme.colors.surfaceRaised,
  },
  sectionTitle: { color: theme.colors.text, fontWeight: '900', fontSize: 13 },
  qCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    backgroundColor: theme.colors.surfaceSoft,
  },
  qLabel: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: theme.colors.card,
  },
  optionChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceRaised,
  },
  optionText: { color: theme.colors.text, fontSize: 12, fontWeight: '600' },
  optionTextActive: { color: theme.colors.primary, fontWeight: '800' },
  attemptRow: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 4,
    backgroundColor: theme.colors.surfaceSoft,
  },
  attemptTitle: { color: theme.colors.text, fontWeight: '800', fontSize: 13 },
  infoCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    backgroundColor: theme.colors.surfaceRaised,
  },
  infoText: { color: theme.colors.muted, fontSize: 12.5, lineHeight: 18 },
});
