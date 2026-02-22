import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import type { Task, TaskAssignedEvent, TaskStatusChangedEvent, TaskStatus } from '../../api/types';
import * as api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useSocket } from '../../realtime/SocketProvider';
import { Screen } from '../../ui/Screen';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Notice } from '../../ui/Notice';
import { MenuButton } from '../../ui/MenuButton';
import { TextField } from '../../ui/TextField';
import { theme } from '../../ui/theme';
import { DEMO_FALLBACK_LOCATION, GOOGLE_MAPS_API_KEY } from '../../config';
import type { BuyerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BuyerStackParamList, 'BuyerTask'>;

function statusLabel(s: TaskStatus) {
  if (s === 'SEARCHING') return 'Searching for helpers…';
  if (s === 'ASSIGNED') return 'Helper assigned';
  if (s === 'ARRIVED') return 'Helper arrived';
  if (s === 'STARTED') return 'Work started';
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

function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const coords: { latitude: number; longitude: number }[] = [];

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    const latitude = lat / 1e5;
    const longitude = lng / 1e5;
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      coords.push({ latitude, longitude });
    }
  }
  return coords;
}

export function BuyerTaskScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const { withAuth } = useAuth();
  const socket = useSocket();

  const [task, setTask] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helperLoc, setHelperLoc] = useState<{ lat: number; lng: number; ts: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeEtaMin, setRouteEtaMin] = useState<number | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingBusy, setRatingBusy] = useState(false);

  const lastRouteFetch = useRef(0);
  const helperMarkerRef = useRef<any>(null);
  const mapRef = useRef<MapView | null>(null);
  const lastFitAt = useRef(0);

  const taskLat = Number(task?.lat);
  const taskLng = Number(task?.lng);
  const hasTaskCoords = Number.isFinite(taskLat) && Number.isFinite(taskLng);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const t = await withAuth((at) => api.getTask(at, taskId));
      setTask(t);
    } catch {
      setError('Could not load task details.');
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

    const onAssigned = (evt: TaskAssignedEvent) => {
      if (!evt || evt.taskId !== taskId) return;
      setTask((prev) =>
        prev ? { ...prev, status: evt.status, assignedHelperId: evt.helperId } : prev,
      );
    };

    const onStatus = (evt: TaskStatusChangedEvent) => {
      if (!evt || evt.taskId !== taskId) return;
      setTask((prev) => (prev ? { ...prev, status: evt.status } : prev));
    };

    const onHelperLoc = (evt: { taskId: string; helperId: string; lat: number; lng: number; ts: number }) => {
      if (!evt || evt.taskId !== taskId) return;
      const nextLat = Number(evt.lat);
      const nextLng = Number(evt.lng);
      if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;
      setHelperLoc({ lat: nextLat, lng: nextLng, ts: evt.ts || Date.now() });
      const marker = helperMarkerRef.current;
      if (marker && typeof marker.animateMarkerToCoordinate === 'function' && Platform.OS === 'android') {
        marker.animateMarkerToCoordinate({ latitude: nextLat, longitude: nextLng }, 900);
      }
      if (hasTaskCoords && mapRef.current) {
        const now = Date.now();
        if (now - lastFitAt.current > 6_000) {
          lastFitAt.current = now;
          mapRef.current.fitToCoordinates(
            [
              { latitude: taskLat, longitude: taskLng },
              { latitude: nextLat, longitude: nextLng },
            ],
            { edgePadding: { top: 80, right: 60, bottom: 100, left: 60 }, animated: true },
          );
        }
      }
    };

    socket.on('task_assigned', onAssigned);
    socket.on('task_status_changed', onStatus);
    socket.on('helper.location', onHelperLoc);
    return () => {
      socket.off('task_assigned', onAssigned);
      socket.off('task_status_changed', onStatus);
      socket.off('helper.location', onHelperLoc);
    };
  }, [socket, taskId, hasTaskCoords, taskLat, taskLng]);

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
        if (poly) {
          setRouteCoords(decodePolyline(poly));
        }
        if (legs?.duration?.value) {
          setRouteEtaMin(Math.max(1, Math.round(legs.duration.value / 60)));
        }
      } catch {
        // best-effort
      }
    };

    fetchRoute();
  }, [helperLoc, task]);

  useEffect(() => {
    if (!mapRef.current || !hasTaskCoords) return;
    mapRef.current.animateToRegion(
      {
        latitude: taskLat,
        longitude: taskLng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      800,
    );
  }, [hasTaskCoords, taskLat, taskLng]);

  const onBackHome = useCallback(() => navigation.popToTop(), [navigation]);

  const status = task?.status ?? 'SEARCHING';
  const helperId = task?.assignedHelperId ?? null;
  const canDone = useMemo(() => status === 'COMPLETED', [status]);
  const helperDistance = useMemo(() => {
    if (!task || !helperLoc || !hasTaskCoords) return null;
    return distanceMeters({ lat: taskLat, lng: taskLng }, { lat: helperLoc.lat, lng: helperLoc.lng });
  }, [helperLoc, hasTaskCoords, task, taskLat, taskLng]);
  const helperEta = useMemo(() => {
    if (routeEtaMin != null) return routeEtaMin;
    if (!helperDistance) return null;
    const minutes = Math.max(1, Math.round(helperDistance / 60));
    return minutes;
  }, [helperDistance, routeEtaMin]);
  const helperLastSeen = useMemo(() => {
    if (!helperLoc?.ts) return null;
    const secs = Math.max(0, Math.floor((Date.now() - helperLoc.ts) / 1000));
    return secs;
  }, [helperLoc]);
  const helperArrived = useMemo(() => {
    if (helperDistance == null) return false;
    return helperDistance <= 60;
  }, [helperDistance]);

  const canRate = status === 'COMPLETED' && !task?.buyerRating;
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

  return (
    <Screen style={styles.screen}>
      <View style={styles.topBar}>
        <MenuButton onPress={() => navigation.navigate('Menu')} />
        <Text style={styles.h1}>Task</Text>
        <Text onPress={onBackHome} style={styles.link}>
          Back
        </Text>
      </View>

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
          {hasTaskCoords ? <Marker coordinate={{ latitude: taskLat, longitude: taskLng }} title="You" /> : null}
          {helperLoc ? (
            <Marker
              ref={helperMarkerRef}
              coordinate={{ latitude: helperLoc.lat, longitude: helperLoc.lng }}
              title="Helper"
            />
          ) : null}
          {routeCoords.length > 1 ? (
            <Polyline coordinates={routeCoords} strokeColor={theme.colors.primary} strokeWidth={4} />
          ) : null}
        </MapView>
      </View>

      <View style={styles.card}>
        <Text style={styles.status}>{statusLabel(status)}</Text>
        {helperArrived ? <Notice kind="success" text="Helper has arrived at your location." /> : null}
        <Text style={styles.muted}>Task ID: {taskId}</Text>
        {task?.title ? <Text style={styles.title}>{task.title}</Text> : null}
        {helperId ? <Text style={styles.muted}>Helper: {helperId}</Text> : null}
        {task?.addressText ? <Text style={styles.muted}>Address: {task.addressText}</Text> : null}
        {task?.description ? <Text style={styles.desc}>{task.description}</Text> : null}
        <Text style={styles.muted}>Urgency: {task?.urgency ?? '-'} | ETA: {task?.timeMinutes ?? '-'} min</Text>
        <Text style={styles.muted}>Budget: INR {task ? (task.budgetPaise / 100).toFixed(0) : '-'}</Text>
        {task?.arrivalOtp ? <Text style={styles.otp}>Arrival OTP: {task.arrivalOtp}</Text> : null}
        {task?.completionOtp ? <Text style={styles.otp}>Completion OTP: {task.completionOtp}</Text> : null}

        <PrimaryButton label="Refresh" onPress={load} loading={busy} variant="ghost" />
      </View>

      <View style={styles.liveCard}>
        <Text style={styles.liveTitle}>Helper on the way</Text>
        <Text style={styles.liveSub}>Live location updates while helper is en route.</Text>
        <View style={styles.liveRow}>
          <View style={styles.liveStat}>
            <Text style={styles.liveLabel}>Distance</Text>
            <Text style={styles.liveValue}>
              {helperDistance == null ? '--' : `${(helperDistance / 1000).toFixed(2)} km`}
            </Text>
          </View>
          <View style={styles.liveStat}>
            <Text style={styles.liveLabel}>ETA</Text>
            <Text style={styles.liveValue}>{helperEta == null ? '--' : `${helperEta} min`}</Text>
          </View>
          <View style={styles.liveStat}>
            <Text style={styles.liveLabel}>Updated</Text>
            <Text style={styles.liveValue}>{helperLastSeen == null ? '--' : `${helperLastSeen}s`}</Text>
          </View>
        </View>
      </View>

      {canDone ? <Notice kind="success" text="Marked as completed by helper." /> : null}

      {status === 'COMPLETED' ? (
        <View style={styles.ratingCard}>
          <Text style={styles.liveTitle}>Rate your Superheroo</Text>
          {task?.buyerRating ? (
            <Text style={styles.muted}>Your rating: {task.buyerRating.toFixed(1)} / 5</Text>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: theme.space.xl },
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
  otp: { color: theme.colors.primary, fontSize: 14, fontWeight: '800', marginTop: 4 },
  liveCard: {
    marginTop: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.xs,
    ...theme.shadow.card,
  },
  mapWrap: {
    marginTop: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    height: 220,
  },
  map: { flex: 1 },
  liveTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '900' },
  liveSub: { color: theme.colors.muted, fontSize: 12 },
  liveRow: { flexDirection: 'row', gap: theme.space.sm, marginTop: theme.space.sm },
  liveStat: { flex: 1, padding: theme.space.sm, borderRadius: theme.radius.md, backgroundColor: '#EEF2FF' },
  liveLabel: { color: theme.colors.muted, fontSize: 11 },
  liveValue: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  ratingCard: {
    marginTop: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  ratingRow: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 24 },
  starOn: { color: theme.colors.accent },
  starOff: { color: theme.colors.border },
});
