import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

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
import { DEMO_FALLBACK_LOCATION, GOOGLE_MAPS_API_KEY } from '../../config';

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

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
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
  const [helperLoc, setHelperLoc] = useState<{ lat: number; lng: number; ts: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeEtaMin, setRouteEtaMin] = useState<number | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingBusy, setRatingBusy] = useState(false);

  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const lastEmitAt = useRef<number>(0);
  const mapRef = useRef<MapView | null>(null);
  const lastFitAt = useRef(0);

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

  const pickSelfie = useCallback(async () => {
    let ImagePicker: typeof import('expo-image-picker') | null = null;
    try {
      ImagePicker = await import('expo-image-picker');
    } catch {
      setError('Image picker is unavailable in this build.');
      return null;
    }

    const IP = ImagePicker;

    const takeCamera = async (): Promise<ImagePickerAsset | null> => {
      try {
        const cam = await IP.requestCameraPermissionsAsync();
        if (cam.status !== 'granted') {
          setError('Camera permission is required. Try choosing from gallery.');
          return null;
        }
        const res = await IP.launchCameraAsync({
          mediaTypes: IP.MediaTypeOptions.Images,
          quality: 0.7,
          allowsEditing: false,
          cameraType: IP.CameraType.front,
        });
        if (!res.canceled && res.assets?.length) {
          return res.assets[0];
        }
        return null;
      } catch {
        setError('Camera is unavailable (e.g. emulator). Please choose from gallery.');
        return null;
      }
    };

    const pickGallery = async (): Promise<ImagePickerAsset | null> => {
      try {
        const perm = await IP.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') {
          setError('Gallery permission is required.');
          return null;
        }
        const pick = await IP.launchImageLibraryAsync({
          mediaTypes: IP.MediaTypeOptions.Images,
          quality: 0.7,
          allowsEditing: false,
        });
        if (pick.canceled || !pick.assets?.length) {
          return null;
        }
        return pick.assets[0];
      } catch {
        setError('Could not open gallery.');
        return null;
      }
    };

    return new Promise<ImagePickerAsset | null>((resolve) => {
      Alert.alert(
        'Take or choose a selfie',
        'You need a selfie for verification. Choose a source:',
        [
          {
            text: 'Camera',
            onPress: async () => {
              const asset = await takeCamera();
              if (asset) {
                resolve(asset);
              } else {
                // Camera failed — auto-fallback to gallery
                const galleryAsset = await pickGallery();
                resolve(galleryAsset);
              }
            },
          },
          {
            text: 'Gallery',
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
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          throw new Error('Location permission missing');
        }
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
            setHelperLoc({ lat, lng, ts: now });
            socket.emit('location.update', { lat, lng, taskId });
            if (hasTaskCoords && mapRef.current) {
              const stamp = Date.now();
              if (stamp - lastFitAt.current > 8_000) {
                lastFitAt.current = stamp;
                mapRef.current.fitToCoordinates(
                  [
                    { latitude: taskLat, longitude: taskLng },
                    { latitude: lat, longitude: lng },
                  ],
                  { edgePadding: { top: 80, right: 60, bottom: 120, left: 60 }, animated: true },
                );
              }
            }
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
          socket.emit('location.update', { lat: task.lat, lng: task.lng, taskId });
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
  }, [hasTaskCoords, socket, task?.lat, task?.lng, taskId, taskLat, taskLng]);

  useEffect(() => {
    if (!task || !helperLoc || !GOOGLE_MAPS_API_KEY || !hasTaskCoords) return;
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
          const points: { latitude: number; longitude: number }[] = [];
          let index = 0;
          let lat = 0;
          let lng = 0;
          while (index < poly.length) {
            let b = 0;
            let shift = 0;
            let result = 0;
            do {
              b = poly.charCodeAt(index++) - 63;
              result |= (b & 0x1f) << shift;
              shift += 5;
            } while (b >= 0x20);
            const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
            lat += dlat;
            shift = 0;
            result = 0;
            do {
              b = poly.charCodeAt(index++) - 63;
              result |= (b & 0x1f) << shift;
              shift += 5;
            } while (b >= 0x20);
            const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
            lng += dlng;
            points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
          }
          setRouteCoords(points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)));
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
          {hasTaskCoords ? <Marker coordinate={{ latitude: taskLat, longitude: taskLng }} title="Buyer" /> : null}
          {helperLoc ? <Marker coordinate={{ latitude: helperLoc.lat, longitude: helperLoc.lng }} title="You" /> : null}
          {routeCoords.length > 1 ? (
            <Polyline coordinates={routeCoords} strokeColor={theme.colors.primary} strokeWidth={4} />
          ) : null}
        </MapView>
      </View>

      <View style={styles.card}>
        <Text style={styles.status}>{statusLabel(status)}</Text>
        <Text style={styles.muted}>Task ID: {taskId}</Text>
        {task?.title ? <Text style={styles.title}>{task.title}</Text> : null}
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

        {status === 'COMPLETED' ? (
          <View style={styles.ratingCard}>
            <Text style={styles.muted}>Rate buyer</Text>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
});
