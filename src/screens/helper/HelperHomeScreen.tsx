import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { HelperProfile, TaskOfferedEvent } from '../../api/types';
import * as api from '../../api/client';
import { ApiError } from '../../api/http';
import { useAuth } from '../../auth/AuthContext';
import { useIsOnline } from '../../hooks/useIsOnline';
import { useSocket } from '../../realtime/SocketProvider';
import { Screen } from '../../ui/Screen';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
import { DEMO_FALLBACK_LOCATION } from '../../config';
import type { HelperStackParamList } from '../../navigation/types';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<HelperStackParamList, 'HelperHome'>;

type OfferRowProps = {
  offer: TaskOfferedEvent;
  onAccept: (taskId: string) => void;
};

const OfferRow = React.memo(function OfferRow({ offer, onAccept }: OfferRowProps) {
  const { t } = useI18n();
  const onPress = useCallback(() => onAccept(offer.taskId), [offer.taskId, onAccept]);
  const km = Math.max(0, offer.distanceMeters / 1000).toFixed(1);
  const budget = (offer.budgetPaise / 100).toFixed(0);
  return (
    <View style={styles.offerRow}>
      <Text style={styles.offerTitle}>{offer.title}</Text>
      <Text style={styles.offerMeta}>{offer.description}</Text>
      <Text style={styles.offerMeta}>Urgency: {offer.urgency} | ETA: {offer.timeMinutes} min | Budget: INR {budget}</Text>
      <Text style={styles.offerMeta}>{km} km away</Text>
      <PrimaryButton label={t('helper.accept')} onPress={onPress} />
    </View>
  );
});

export function HelperHomeScreen({ navigation }: Props) {
  const { withAuth, signOut } = useAuth();
  const { t } = useI18n();
  const socket = useSocket();
  const online = useIsOnline();

  const [profile, setProfile] = useState<HelperProfile | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [offers, setOffers] = useState<TaskOfferedEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [autoKycDone, setAutoKycDone] = useState(false);

  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const lastEmitAt = useRef<number>(0);
  const lastCoords = useRef<{ lat: number; lng: number } | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const p = await withAuth((t) => api.helperGetProfile(t));
      setProfile(p);
    } catch {
      // keep existing behavior when profile endpoint is unavailable
    }
  }, [withAuth]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      loadProfile();
    });
    return unsub;
  }, [loadProfile, navigation]);

  useEffect(() => {
    if (!autoKycDone && profile && profile.kycStatus !== 'APPROVED') {
      setAutoKycDone(true);
      navigation.navigate('HelperKyc');
    }
  }, [autoKycDone, navigation, profile]);

  const goOnline = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!online) {
      setNotice('You are offline.');
      return false;
    }
    if (profile && profile.kycStatus !== 'APPROVED') {
      setNotice('Complete KYC and wait for admin approval before going online.');
      return false;
    }

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (DEMO_FALLBACK_LOCATION) {
          const { lat, lng } = DEMO_FALLBACK_LOCATION;
          lastCoords.current = { lat, lng };
          await withAuth((t) => api.helperSetOnline(t, true, lat, lng));
          setNotice('GPS unavailable. Using demo fallback location.');
          setIsOnline(true);
          setOffers([]);
          return true;
        }
        setNotice('Location is turned off. Enable Location in device settings and try again.');
        return false;
      }

      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        if (DEMO_FALLBACK_LOCATION) {
          const { lat, lng } = DEMO_FALLBACK_LOCATION;
          lastCoords.current = { lat, lng };
          await withAuth((t) => api.helperSetOnline(t, true, lat, lng));
          setNotice('Location permission missing. Using demo fallback location.');
          setIsOnline(true);
          setOffers([]);
          return true;
        }
        setNotice('Location permission is required to go online.');
        return false;
      }

      try {
        const st = await Location.getProviderStatusAsync();
        if (st.locationServicesEnabled && st.gpsAvailable === false && st.networkAvailable === false) {
          await Location.enableNetworkProviderAsync();
        }
      } catch {
        // best effort
      }

      const last = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000, requiredAccuracy: 2_000 });
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      lastCoords.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      await withAuth((t) => api.helperSetOnline(t, true, pos.coords.latitude, pos.coords.longitude));
      setIsOnline(true);
      setOffers([]);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setNotice('Your helper account is pending approval. Please wait for admin verification.');
        return false;
      }
      if (DEMO_FALLBACK_LOCATION) {
        const { lat, lng } = DEMO_FALLBACK_LOCATION;
        try {
          lastCoords.current = { lat, lng };
          await withAuth((t) => api.helperSetOnline(t, true, lat, lng));
          setNotice('Current location unavailable. Using demo fallback location.');
          setIsOnline(true);
          setOffers([]);
          return true;
        } catch {
          // fall through
        }
      }
      setError('Could not go online. Try again.');
      return false;
    }
  }, [online, profile, withAuth]);

  const goOffline = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      await withAuth((t) => api.helperSetOnline(t, false));
    } catch {
      // best-effort
    }
    setIsOnline(false);
    setOffers([]);
  }, [withAuth]);

  const toggleOnline = useCallback(async () => {
    if (isOnline) {
      await goOffline();
    } else {
      await goOnline();
    }
  }, [goOffline, goOnline, isOnline]);

  const acceptOffer = useCallback(
    async (taskId: string) => {
      setError(null);
      try {
        await withAuth((t) => api.acceptTask(t, taskId));
        navigation.navigate('HelperTask', { taskId });
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setNotice('Offer expired or task already taken.');
          setOffers((prev) => prev.filter((o) => o.taskId !== taskId));
          return;
        }
        setError('Could not accept task.');
      }
    },
    [navigation, withAuth],
  );

  useEffect(() => {
    if (!socket) return;
    const onOffered = (evt: TaskOfferedEvent) => {
      if (!evt || !evt.taskId) return;
      setOffers((prev) => {
        if (prev.some((p) => p.taskId === evt.taskId)) return prev;
        return [evt, ...prev].slice(0, 20);
      });
    };
    socket.on('task.offered', onOffered);
    return () => {
      socket.off('task.offered', onOffered);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !isOnline) return;

    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const start = async () => {
      try {
        locationSub.current?.remove();
        locationSub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15_000,
            distanceInterval: 25,
          },
          (pos) => {
            if (cancelled) return;
            const now = Date.now();
            if (now - lastEmitAt.current < 5_000) return;
            lastEmitAt.current = now;
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            lastCoords.current = { lat, lng };
            socket.emit('location.update', { lat, lng });
          },
        );
      } catch {
        setNotice('Location tracking unavailable. You may not receive offers reliably.');
      }
    };

    start();
    const startHeartbeat = () => {
      if (heartbeat) return;
      heartbeat = setInterval(() => {
        if (cancelled) return;
        const c = lastCoords.current;
        if (!c) return;
        const now = Date.now();
        if (now - lastEmitAt.current < 12_000) return;
        lastEmitAt.current = now;
        socket.emit('location.update', { lat: c.lat, lng: c.lng });
      }, 15_000);
    };

    const stopHeartbeat = () => {
      if (!heartbeat) return;
      clearInterval(heartbeat);
      heartbeat = null;
    };

    startHeartbeat();

    const appSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        locationSub.current?.remove();
        locationSub.current = null;
        stopHeartbeat();
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
  }, [isOnline, socket]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.h1}>Superheroo</Text>
        <View style={styles.topLinks}>
          <Text onPress={() => navigation.navigate('SupportTickets')} style={styles.link}>
            {t('buyer.support')}
          </Text>
          <Text onPress={signOut} style={styles.link}>
            {t('buyer.sign_out')}
          </Text>
        </View>
      </View>

      {!online ? <Notice kind="warning" text={t('buyer.offline')} /> : null}
      {profile?.kycStatus === 'PENDING' ? (
        <Notice kind="warning" text="KYC pending review. Upload or update docs from Complete KYC." />
      ) : null}
      {profile?.kycStatus === 'REJECTED' ? (
        <Notice kind="danger" text={`KYC rejected${profile.kycRejectionReason ? `: ${profile.kycRejectionReason}` : ''}. Please re-submit.`} />
      ) : null}
      {notice ? <Notice kind="warning" text={notice} /> : null}
      {error ? <Notice kind="danger" text={error} /> : null}

      <View style={styles.card}>
        <Text style={styles.section}>{t('helper.availability')}</Text>
        <View style={styles.actionsRow}>
          <PrimaryButton
            label={t('helper.complete_kyc')}
            onPress={() => navigation.navigate('HelperKyc')}
            variant="ghost"
            style={styles.half}
          />
          <PrimaryButton
            label={isOnline ? t('helper.offline') : t('helper.online')}
            onPress={toggleOnline}
            variant={isOnline ? 'danger' : 'primary'}
            style={styles.half}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>{t('helper.nearby_tasks')}</Text>
        <FlatList
          data={offers}
          keyExtractor={(o) => o.taskId}
          renderItem={({ item }) => <OfferRow offer={item} onAccept={acceptOffer} />}
          contentContainerStyle={styles.offerList}
          initialNumToRender={6}
          windowSize={6}
          removeClippedSubviews
          ListEmptyComponent={<Text style={styles.muted}>{isOnline ? t('helper.no_offers') : t('helper.go_online_receive')}</Text>}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: theme.space.xl },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topLinks: { flexDirection: 'row', alignItems: 'center', gap: 14 },
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
  section: { color: theme.colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.25 },
  actionsRow: { flexDirection: 'row', gap: theme.space.sm, marginTop: 8 },
  half: { flex: 1 },
  offerList: { gap: 12, paddingTop: 6 },
  offerRow: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: 10,
    backgroundColor: theme.colors.card,
    ...theme.shadow.card,
  },
  offerTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '800', lineHeight: 20 },
  offerMeta: { color: theme.colors.muted, fontSize: 12 },
  muted: { color: theme.colors.muted },
});
