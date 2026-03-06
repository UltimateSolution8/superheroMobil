import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Asset } from 'react-native-image-picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import type { Task, TaskStatus, TaskStatusChangedEvent } from '../../api/types';
import * as api from '../../api/client';
import { distanceMeters, decodePolyline } from '../../utils/geo';
import { useAuth } from '../../auth/AuthContext';
import { useSocket } from '../../realtime/SocketProvider';
import { Screen } from '../../ui/Screen';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Notice } from '../../ui/Notice';
import { TextField } from '../../ui/TextField';
import { MenuButton } from '../../ui/MenuButton';
import { TaskSkeleton } from '../../ui/TaskSkeleton';
import { theme } from '../../ui/theme';
import { ensureCameraPermissions, ensureGalleryPermissions } from '../../utils/permissions';
import { assetToPickedFile } from '../../utils/media';
import type { HelperStackParamList } from '../../navigation/types';
import { DEMO_FALLBACK_LOCATION, GOOGLE_MAPS_API_KEY } from '../../config';
import { useActiveTask } from '../../state/ActiveTaskContext';

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
  if (s === 'CANCELLED') return 'Cancelled';
  return s;
}

export function HelperTaskScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const { withAuth } = useAuth();
  const socket = useSocket();
  const { setActiveTaskId } = useActiveTask();

  const [task, setTask] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [arrivalOtp, setArrivalOtp] = useState('');
  const [completionOtp, setCompletionOtp] = useState('');
  const [helperLoc, setHelperLoc] = useState<{ lat: number; lng: number; ts: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeEtaMin, setRouteEtaMin] = useState<number | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingBusy, setRatingBusy] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [ratingReady, setRatingReady] = useState(false);
  const [completionSelfieBusy, setCompletionSelfieBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const arrivalSelfieDone = Boolean(task?.arrivalSelfieUrl);
  const buyerPhone = useMemo(() => {
    const raw = task?.buyerPhone;
    if (typeof raw === 'string') return raw.trim();
    if (raw == null) return '';
    return String(raw);
  }, [task?.buyerPhone]);

  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const lastEmitAt = useRef<number>(0);
  const mapRef = useRef<MapView | null>(null);

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
      setInitialLoad(false);
    }
  }, [taskId, withAuth]);

  // Only useFocusEffect — fires on both mount + re-focus (fixes double load)
  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load]),
  );

  useEffect(() => {
    if (!socket) return;
    if (task?.buyerId) {
      socket.emit('task.subscribe', { taskId, buyerId: task.buyerId });
    } else {
      socket.emit('task.subscribe', { taskId });
    }

    const onStatus = (evt: TaskStatusChangedEvent) => {
      if (!evt || evt.taskId !== taskId) return;
      setTask((prev) => (prev ? { ...prev, status: evt.status } : prev));
    };
    socket.on('task_status_changed', onStatus);
    return () => {
      socket.off('task_status_changed', onStatus);
    };
  }, [socket, task?.buyerId, taskId]);

  const status = task?.status ?? 'ASSIGNED';
  const next = useMemo(() => nextStatus(status), [status]);
  const canCancel = status === 'ASSIGNED' || status === 'SEARCHING';
  const completionSelfieDone = Boolean(task?.completionSelfieUrl);
  const previousStatus = useRef<TaskStatus | null>(null);

  useEffect(() => {
    if (previousStatus.current && previousStatus.current !== 'COMPLETED' && status === 'COMPLETED') {
      setShowCelebration(true);
      setRatingReady(false);
    }
    previousStatus.current = status;
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      setActiveTaskId(null);
    }
  }, [setActiveTaskId, status]);

  const taskLat = Number(task?.lat);
  const taskLng = Number(task?.lng);
  const hasTaskCoords = Number.isFinite(taskLat) && Number.isFinite(taskLng);

  const helperDistance = useMemo(() => {
    if (!helperLoc || !hasTaskCoords) return null;
    return distanceMeters({ lat: helperLoc.lat, lng: helperLoc.lng }, { lat: taskLat, lng: taskLng });
  }, [helperLoc, hasTaskCoords, taskLat, taskLng]);

  const helperEta = useMemo(() => {
    if (routeEtaMin != null) return routeEtaMin;
    if (helperDistance == null) return null;
    return Math.max(1, Math.round(helperDistance / 60));
  }, [helperDistance, routeEtaMin]);

  const canRate = status === 'COMPLETED' && !task?.helperRating;
  const submitRating = useCallback(async () => {
    if (!canRate || ratingBusy) return;
    setRatingBusy(true);
    setError(null);
    try {
      const updated = await withAuth((at) => api.rateTask(at, taskId, rating, ratingComment.trim() || null));
      setTask(updated);
    } catch {
      setError('Could not submit rating.');
    } finally {
      setRatingBusy(false);
    }
  }, [canRate, rating, ratingBusy, ratingComment, taskId, withAuth]);

  const submitCancel = useCallback(async () => {
    if (!canCancel || cancelBusy) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setError('Please add a cancellation reason.');
      return;
    }
    setCancelBusy(true);
    setError(null);
    try {
      const updated = await withAuth((at) => api.cancelTask(at, taskId, reason));
      setTask(updated);
      setCancelReason('');
    } catch {
      setError('Could not cancel the task.');
    } finally {
      setCancelBusy(false);
    }
  }, [canCancel, cancelBusy, cancelReason, taskId, withAuth]);

  const pickSelfie = useCallback(async () => {
    const takeCamera = async (): Promise<Asset | null> => {
      try {
        const allowed = await ensureCameraPermissions();
        if (!allowed) {
          setError('Camera permission is required to capture a selfie.');
          return null;
        }
        const res = await launchCamera({
          mediaType: 'photo',
          quality: 0.6,
          cameraType: 'front',
          saveToPhotos: false,
          includeExtra: true,
          maxWidth: 960,
          maxHeight: 960,
        });
        if (res.didCancel) return null;
        if (res.errorCode) {
          setError('Camera is unavailable. Please choose from gallery.');
          return null;
        }
        return res.assets?.[0] ?? null;
      } catch {
        setError('Camera is unavailable. Please choose from gallery.');
        return null;
      }
    };

    const pickGallery = async (): Promise<Asset | null> => {
      try {
        const allowed = await ensureGalleryPermissions();
        if (!allowed) {
          setError('Gallery permission is required to select a selfie.');
          return null;
        }
        const pick = await launchImageLibrary({
          mediaType: 'photo',
          quality: 0.6,
          selectionLimit: 1,
          includeExtra: true,
          maxWidth: 960,
          maxHeight: 960,
        });
        if (pick.didCancel) return null;
        if (pick.errorCode) {
          setError('Could not open gallery.');
          return null;
        }
        return pick.assets?.[0] ?? null;
      } catch {
        setError('Could not open gallery.');
        return null;
      }
    };

    const cameraAsset = await takeCamera();
    if (cameraAsset?.uri) return cameraAsset;

    return new Promise<Asset | null>((resolve) => {
      Alert.alert(
        'Camera unavailable',
        'Would you like to choose a selfie from your gallery?',
        [
          {
            text: 'Choose from gallery',
            onPress: async () => {
              const asset = await pickGallery();
              resolve(asset);
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
      if (!a || !a.uri) return false;

      const selfie = assetToPickedFile(a, `${stage.toLowerCase()}-selfie-${Date.now()}.jpg`);
      if (!selfie) {
        setError('Could not access captured image.');
        return false;
      }

      let lat = task?.lat ?? 0;
      let lng = task?.lng ?? 0;
      let address = task?.addressText ?? '';

      const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
        ]);
      };

      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          throw new Error('Location permission missing');
        }
        const p = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          8000,
        );
        lat = p.coords.latitude;
        lng = p.coords.longitude;
        const rev = await withTimeout(
          Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }),
          6000,
        );
        const first = rev[0];
        if (first) {
          const parts = [first.name, first.street, first.city, first.region, first.postalCode].filter(Boolean);
          address = parts.join(', ');
        }
      } catch {
        // best effort
      }

      try {
        setNotice(`Uploading ${stage === 'ARRIVAL' ? 'arrival' : 'completion'} selfie...`);
        setTimeout(() => setNotice(null), 2500);
        const updated = await withTimeout(
          withAuth((at) =>
            api.uploadTaskSelfie(at, taskId, {
              stage,
              lat,
              lng,
              addressText: address,
              capturedAt: new Date().toISOString(),
              selfie,
            }),
          ),
          25_000,
        );
        setTask(updated);
        return true;
      } catch (err) {
        if (err instanceof Error && err.message) {
          setError(err.message);
        } else {
          setError('Selfie upload failed. Please try again.');
        }
        return false;
      }
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
        if (!arrivalSelfieDone) {
          const done = await uploadCheckpointSelfie('ARRIVAL');
          if (!done) {
            setBusy(false);
            return;
          }
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
        if (!completionSelfieDone) {
          setError('Please upload the completion selfie first.');
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
    } catch (e) {
      if (e instanceof Error && e.message) {
        setError(e.message);
      } else {
        setError('Could not update status.');
      }
    } finally {
      setBusy(false);
    }
  }, [arrivalOtp, busy, completionOtp, next, taskId, uploadCheckpointSelfie, withAuth]);

  const uploadCompletionSelfie = useCallback(async () => {
    if (completionSelfieBusy || completionSelfieDone) return;
    setCompletionSelfieBusy(true);
    setError(null);
    try {
      const done = await uploadCheckpointSelfie('COMPLETION');
      if (!done) return;
      const refreshed = await withAuth((at) => api.getTask(at, taskId));
      setTask(refreshed);
      setNotice('Completion selfie uploaded. Enter OTP to finish.');
      setTimeout(() => setNotice(null), 2000);
    } catch {
      setError('Selfie upload failed. Please try again.');
    } finally {
      setCompletionSelfieBusy(false);
    }
  }, [completionSelfieBusy, completionSelfieDone, taskId, uploadCheckpointSelfie, withAuth]);

  const backHome = useCallback(() => navigation.popToTop(), [navigation]);

  const openMaps = useCallback(() => {
    if (!hasTaskCoords) return;
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${taskLat},${taskLng}`,
      android: `https://www.google.com/maps/dir/?api=1&destination=${taskLat},${taskLng}`,
    });
    if (url) {
      Linking.openURL(url);
    }
  }, [hasTaskCoords, taskLat, taskLng]);

  const shouldUpdateLoc = useCallback((nextLoc: { lat: number; lng: number; ts: number }) => {
    if (!helperLoc) return true;
    const dist = distanceMeters({ lat: helperLoc.lat, lng: helperLoc.lng }, { lat: nextLoc.lat, lng: nextLoc.lng });
    if (dist < 6 && Math.abs(nextLoc.ts - helperLoc.ts) < 8000) return false;
    return true;
  }, [helperLoc]);

  useEffect(() => {
    if (!socket) return;
    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const start = async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
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
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const nextLoc = { lat, lng, ts: now };
            if (shouldUpdateLoc(nextLoc)) {
              setHelperLoc(nextLoc);
            }
            // location updates are handled by the global presence tracker
            // keep map stable to avoid UI flicker on some devices
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
          // location updates are handled by the global presence tracker
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
  }, [hasTaskCoords, shouldUpdateLoc, socket, task?.lat, task?.lng, taskId, taskLat, taskLng]);

  const lastRouteFetch = useRef(0);
  useEffect(() => {
    if (!task || !helperLoc || !GOOGLE_MAPS_API_KEY || !hasTaskCoords) return;
    const now = Date.now();
    if (now - lastRouteFetch.current < 12_000) return;
    lastRouteFetch.current = now;
    const fetchRoute = async () => {
      try {
        const url =
          'https://maps.googleapis.com/maps/api/directions/json' +
          `?origin=${helperLoc.lat},${helperLoc.lng}` +
          `&destination=${taskLat},${taskLng}` +
          `&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
        const res = await fetch(url);
        const json = await res.json();
        const route = json?.routes?.[0];
        const poly = route?.overview_polyline?.points;
        const legs = route?.legs?.[0];
        if (poly && typeof poly === 'string') {
          const points = decodePolyline(poly);
          setRouteCoords(points);
        }
        if (legs?.duration?.value) {
          setRouteEtaMin(Math.max(1, Math.round(legs.duration.value / 60)));
        }
      } catch {
        // best effort
      }
    };
    fetchRoute();
  }, [helperLoc, hasTaskCoords, task, taskLat, taskLng]);

  if (initialLoad) {
    return (
      <Screen>
        <View style={styles.topBar}>
          <MenuButton onPress={() => navigation.navigate('Menu')} />
          <Text style={styles.h1}>Job</Text>
          <View style={styles.topActions} />
        </View>
        <TaskSkeleton />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.topBar}>
          <MenuButton onPress={() => navigation.navigate('Menu')} />
          <Text style={styles.h1}>Job</Text>
          <View style={styles.topActions}>
            <Text onPress={load} style={styles.link}>Refresh</Text>
            <Text onPress={backHome} style={styles.link}>Back</Text>
          </View>
        </View>

        {buyerPhone ? (
          <View style={styles.contactRow}>
            <View>
              <Text style={styles.label}>Super-customer</Text>
              <Text style={styles.value}>{task?.buyerName ?? buyerPhone}</Text>
              <Text style={styles.value}>{buyerPhone}</Text>
            </View>
            <PrimaryButton
              label="Call super-customer"
              onPress={() => Linking.openURL(`tel:${buyerPhone}`)}
              variant="ghost"
              style={styles.callButton}
            />
          </View>
        ) : null}

        {notice ? <Notice kind="success" text={notice} /> : null}
        {error ? <Notice kind="danger" text={error} /> : null}

        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            ref={mapRef}
            initialRegion={{
              latitude: hasTaskCoords ? taskLat : DEMO_FALLBACK_LOCATION?.lat ?? 12.9716,
              longitude: hasTaskCoords ? taskLng : DEMO_FALLBACK_LOCATION?.lng ?? 77.5946,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            {hasTaskCoords ? <Marker coordinate={{ latitude: taskLat, longitude: taskLng }} title="Super-customer" /> : null}
            {helperLoc ? <Marker coordinate={{ latitude: helperLoc.lat, longitude: helperLoc.lng }} title="You" /> : null}
            {routeCoords.length > 1 ? (
              <Polyline coordinates={routeCoords} strokeColor={theme.colors.primary} strokeWidth={4} />
            ) : null}
          </MapView>
        </View>

        <View style={styles.card}>
          <Text style={styles.status}>{statusLabel(status)}</Text>
          {task?.title ? <Text style={styles.title}>{task.title}</Text> : null}
          {task?.buyerName ? <Text style={styles.muted}>Super-customer: {task.buyerName}</Text> : null}
          {task?.addressText ? <Text style={styles.muted}>Address: {task.addressText}</Text> : null}
          {task?.description ? <Text style={styles.desc}>{task.description}</Text> : null}
          <Text style={styles.muted}>
            Distance: {helperDistance == null ? '--' : `${(helperDistance / 1000).toFixed(2)} km`} • ETA:{' '}
            {helperEta == null ? '--' : `${helperEta} min`}
          </Text>
          <PrimaryButton label="Open in Maps" onPress={openMaps} variant="ghost" />

          {next === 'STARTED' ? (
            <View>
              <Text style={styles.muted}>Arrival OTP</Text>
              <Text style={styles.otpHint}>Ask the super-customer for the arrival OTP to start work.</Text>
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
              <Text style={styles.muted}>Completion</Text>
              <Text style={styles.otpHint}>Upload completion selfie first, then enter OTP to finish.</Text>
              <PrimaryButton
                label={completionSelfieDone ? 'Completion selfie uploaded' : 'Upload completion selfie'}
                onPress={uploadCompletionSelfie}
                loading={completionSelfieBusy}
                disabled={completionSelfieDone}
                variant="ghost"
              />
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
              disabled={!next || (next === 'COMPLETED' && !completionSelfieDone)}
              loading={busy}
              style={styles.half}
            />
          </View>

          {canCancel ? (
            <>
              <TextField
                label="Cancellation reason"
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="Share why you are cancelling"
              />
              <PrimaryButton
                label="Cancel task"
                onPress={submitCancel}
                loading={cancelBusy}
                variant="danger"
              />
            </>
          ) : null}

          {showCelebration ? (
            <View style={styles.celebrateWrap}>
              <View style={styles.celebrateCard}>
                <Text style={styles.celebrateTitle}>Task completed</Text>
                <Text style={styles.celebrateBody}>Great work! Please rate your super-customer.</Text>
                <PrimaryButton
                  label="Continue"
                  onPress={() => {
                    setShowCelebration(false);
                    setRatingReady(true);
                  }}
                />
              </View>
            </View>
          ) : null}

          {status === 'COMPLETED' && ratingReady ? (
            <View style={styles.ratingCard}>
              <Text style={styles.muted}>Rate super-customer</Text>
              {task?.helperRating ? (
                <Text style={styles.muted}>Your rating: {task.helperRating.toFixed(1)} / 5</Text>
              ) : (
                <>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <Text
                        key={`rate-${r}`}
                        style={[styles.star, r <= rating ? styles.starOn : styles.starOff]}
                        onPress={() => setRating(r)}
                      >
                        ★
                      </Text>
                    ))}
                  </View>
                  <TextField
                    label="Comment (optional)"
                    value={ratingComment}
                    onChangeText={setRatingComment}
                    placeholder="Share feedback"
                  />
                  <PrimaryButton label="Submit rating" onPress={submitRating} loading={ratingBusy} />
                </>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scrollContent: { gap: theme.space.md, paddingBottom: theme.space.xl, position: 'relative', minHeight: '100%' },
  topActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  contactRow: {
    marginTop: theme.space.sm,
    padding: theme.space.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  label: { color: theme.colors.muted, fontSize: 11 },
  value: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  callButton: { paddingHorizontal: theme.space.md },
  h1: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  link: { color: theme.colors.primary, fontWeight: '800' },
  mapWrap: {
    marginTop: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    height: 220,
  },
  map: { flex: 1 },
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
  ratingCard: {
    marginTop: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
    backgroundColor: theme.colors.card,
  },
  ratingRow: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 24 },
  starOn: { color: theme.colors.accent },
  starOff: { color: theme.colors.border },
  celebrateWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 12, 22, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.space.lg,
    zIndex: 10,
  },
  celebrateCard: {
    width: '100%',
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    padding: theme.space.lg,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  celebrateTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  celebrateBody: { color: theme.colors.muted, fontSize: 13, lineHeight: 20 },
});
