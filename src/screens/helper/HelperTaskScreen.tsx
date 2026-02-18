import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { Task, TaskStatus, TaskStatusChangedEvent } from '../../api/types';
import * as api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useSocket } from '../../realtime/SocketProvider';
import { Screen } from '../../ui/Screen';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
import type { HelperStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<HelperStackParamList, 'HelperTask'>;

type PickedFile = { uri: string; name: string; type: string };

function nextStatus(s: TaskStatus): TaskStatus | null {
  if (s === 'ASSIGNED') return 'ARRIVED';
  if (s === 'ARRIVED') return 'STARTED';
  if (s === 'STARTED') return 'COMPLETED';
  return null;
}

function statusLabel(s: TaskStatus) {
  if (s === 'SEARCHING') return 'Searching';
  if (s === 'ASSIGNED') return 'Assigned';
  if (s === 'ARRIVED') return 'Arrived';
  if (s === 'STARTED') return 'Started';
  if (s === 'COMPLETED') return 'Completed';
  return s;
}

export function HelperTaskScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const { withAuth } = useAuth();
  const socket = useSocket();

  const [task, setTask] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const t = await withAuth((at) => api.getTask(at, taskId));
      setTask(t);
    } catch {
      setError('Could not load task.');
    } finally {
      setBusy(false);
    }
  }, [taskId, withAuth]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('task.subscribe', { taskId });

    const onStatus = (evt: TaskStatusChangedEvent) => {
      if (!evt || evt.taskId !== taskId) return;
      setTask((prev) => (prev ? { ...prev, status: evt.status } : prev));
    };
    socket.on('task_status_changed', onStatus);
    return () => {
      socket.off('task_status_changed', onStatus);
    };
  }, [socket, taskId]);

  const status = task?.status ?? 'ASSIGNED';
  const next = useMemo(() => nextStatus(status), [status]);

  const uploadCheckpointSelfie = useCallback(
    async (stage: 'ARRIVAL' | 'COMPLETION') => {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (pick.canceled || !pick.assets?.length) return false;

      const a = pick.assets[0];
      const selfie: PickedFile = {
        uri: a.uri,
        name: a.name ?? `${stage.toLowerCase()}-selfie-${Date.now()}.jpg`,
        type: a.mimeType ?? 'image/jpeg',
      };

      let lat = task?.lat ?? 0;
      let lng = task?.lng ?? 0;
      let address = task?.addressText ?? '';

      try {
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = p.coords.latitude;
        lng = p.coords.longitude;
        const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const first = rev[0];
        if (first) {
          const parts = [first.name, first.street, first.city, first.region, first.postalCode].filter(Boolean);
          address = parts.join(', ');
        }
      } catch {
        // best effort
      }

      await withAuth((at) =>
        api.uploadTaskSelfie(at, taskId, {
          stage,
          lat,
          lng,
          addressText: address,
          capturedAt: new Date().toISOString(),
          selfie,
        }),
      );
      return true;
    },
    [task, taskId, withAuth],
  );

  const advance = useCallback(async () => {
    if (!next || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (next === 'ARRIVED') {
        const done = await uploadCheckpointSelfie('ARRIVAL');
        if (!done) {
          setBusy(false);
          return;
        }
      }
      if (next === 'COMPLETED') {
        const done = await uploadCheckpointSelfie('COMPLETION');
        if (!done) {
          setBusy(false);
          return;
        }
      }

      const updated = await withAuth((at) => api.updateTaskStatus(at, taskId, next));
      setTask(updated);
      setNotice(`Status updated: ${statusLabel(next)}`);
      setTimeout(() => setNotice(null), 1500);
    } catch {
      setError('Could not update status.');
    } finally {
      setBusy(false);
    }
  }, [busy, next, taskId, uploadCheckpointSelfie, withAuth]);

  const backHome = useCallback(() => navigation.popToTop(), [navigation]);

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.h1}>Job</Text>
        <Text onPress={backHome} style={styles.link}>
          Back
        </Text>
      </View>

      {notice ? <Notice kind="success" text={notice} /> : null}
      {error ? <Notice kind="danger" text={error} /> : null}

      <View style={styles.card}>
        <Text style={styles.status}>{statusLabel(status)}</Text>
        <Text style={styles.muted}>Task ID: {taskId}</Text>
        {task?.title ? <Text style={styles.title}>{task.title}</Text> : null}
        {task?.addressText ? <Text style={styles.muted}>Address: {task.addressText}</Text> : null}
        {task?.description ? <Text style={styles.desc}>{task.description}</Text> : null}

        <View style={styles.actions}>
          <PrimaryButton label="Refresh" onPress={load} variant="ghost" style={styles.half} />
          <PrimaryButton
            label={next ? `Mark ${statusLabel(next)}` : 'Done'}
            onPress={advance}
            disabled={!next}
            loading={busy}
            style={styles.half}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  link: { color: theme.colors.primary, fontWeight: '800' },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  status: { color: theme.colors.text, fontSize: 18, fontWeight: '900' },
  title: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  muted: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  desc: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: theme.space.sm, paddingTop: 8 },
  half: { flex: 1 },
});
