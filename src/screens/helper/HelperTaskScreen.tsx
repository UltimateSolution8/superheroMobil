import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { Task, TaskStatus, TaskStatusChangedEvent } from '../../api/types';
import * as api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useSocket } from '../../realtime/SocketProvider';
import { Screen } from '../../ui/Screen';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Notice } from '../../ui/Notice';
import { TextField } from '../../ui/TextField';
import { MenuButton } from '../../ui/MenuButton';
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
  const [arrivalOtp, setArrivalOtp] = useState('');
  const [completionOtp, setCompletionOtp] = useState('');

  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const lastEmitAt = useRef<number>(0);

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

  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load]),
  );

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

  const pickSelfie = useCallback(async () => {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (cam.status !== 'granted') {
      setError('Camera permission is required.');
      return null;
    }

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!res.canceled && res.assets?.length) {
      return res.assets[0];
    }

    return new Promise<ImagePicker.ImagePickerAsset | null>((resolve) => {
      Alert.alert(
        'Use a gallery photo?',
        'Camera was closed. You can choose a saved selfie instead.',
        [
          {
            text: 'Choose from gallery',
            onPress: async () => {
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (perm.status !== 'granted') {
                setError('Gallery permission is required.');
                resolve(null);
                return;
              }
              const pick = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                allowsEditing: false,
              });
              if (pick.canceled || !pick.assets?.length) {
                resolve(null);
                return;
              }
              resolve(pick.assets[0]);
            },
          },
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        ],
        { cancelable: true },
      );
    });
  }, []);

  const uploadCheckpointSelfie = useCallback(
    async (stage: 'ARRIVAL' | 'COMPLETION') => {
      const a = await pickSelfie();
      if (!a) return false;

      const selfie: PickedFile = {
        uri: a.uri,
        name: a.fileName ?? `${stage.toLowerCase()}-selfie-${Date.now()}.jpg`,
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
      if (next === 'STARTED') {
        if (!arrivalOtp.trim()) {
          setError('Arrival OTP is required to start work.');
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
        if (!completionOtp.trim()) {
          setError('Completion OTP is required to finish work.');
          setBusy(false);
          return;
        }
      }

      const otp = next === 'STARTED' ? arrivalOtp.trim() : next === 'COMPLETED' ? completionOtp.trim() : null;
      const updated = await withAuth((at) => api.updateTaskStatus(at, taskId, next, otp));
      setTask(updated);
      setNotice(`Status updated: ${statusLabel(next)}`);
      setTimeout(() => setNotice(null), 1500);
    } catch {
      setError('Could not update status.');
    } finally {
      setBusy(false);
    }
  }, [arrivalOtp, busy, completionOtp, next, taskId, uploadCheckpointSelfie, withAuth]);

  const backHome = useCallback(() => navigation.popToTop(), [navigation]);

  useEffect(() => {
    if (!socket) return;
    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const start = async () => {
      try {
        locationSub.current?.remove();
        locationSub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10_000,
            distanceInterval: 15,
          },
          (pos) => {
            if (cancelled) return;
            const now = Date.now();
            if (now - lastEmitAt.current < 5_000) return;
            lastEmitAt.current = now;
            socket.emit('location.update', { lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
        );
      } catch {
        // best effort
      }
    };

    const startHeartbeat = () => {
      if (heartbeat) return;
      heartbeat = setInterval(() => {
        if (cancelled) return;
        const now = Date.now();
        if (now - lastEmitAt.current < 12_000) return;
        lastEmitAt.current = now;
        // send a heartbeat using last known location from task coords if no live GPS
        if (task?.lat && task?.lng) {
          socket.emit('location.update', { lat: task.lat, lng: task.lng });
        }
      }, 12_000);
    };

    start();
    startHeartbeat();
    const appSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        locationSub.current?.remove();
        locationSub.current = null;
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
      } else {
        start();
        startHeartbeat();
      }
    });

    return () => {
      cancelled = true;
      appSub.remove();
      if (heartbeat) clearInterval(heartbeat);
      locationSub.current?.remove();
      locationSub.current = null;
    };
  }, [socket, task?.lat, task?.lng]);

  return (
    <Screen>
      <View style={styles.topBar}>
        <MenuButton onPress={() => navigation.navigate('Menu')} />
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

        {next === 'STARTED' ? (
          <View>
            <Text style={styles.muted}>Arrival OTP</Text>
            <Text style={styles.otpHint}>Ask buyer for the arrival OTP to start work.</Text>
            <TextField
              label="Arrival OTP"
              value={arrivalOtp}
              onChangeText={setArrivalOtp}
              placeholder="Enter arrival OTP"
              keyboardType="number-pad"
            />
          </View>
        ) : null}

        {next === 'COMPLETED' ? (
          <View>
            <Text style={styles.muted}>Completion OTP</Text>
            <Text style={styles.otpHint}>Ask buyer for the completion OTP to finish work.</Text>
            <TextField
              label="Completion OTP"
              value={completionOtp}
              onChangeText={setCompletionOtp}
              placeholder="Enter completion OTP"
              keyboardType="number-pad"
            />
          </View>
        ) : null}

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
  otpHint: { color: theme.colors.muted, fontSize: 12, marginBottom: 6 },
  actions: { flexDirection: 'row', gap: theme.space.sm, paddingTop: 8 },
  half: { flex: 1 },
});
