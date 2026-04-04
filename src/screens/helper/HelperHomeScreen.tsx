import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { HelperProfile, TaskOfferedEvent, TaskStatus } from '../../api/types';
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
import { useHelperPresence } from '../../state/HelperPresenceContext';
import { useActiveTask } from '../../state/ActiveTaskContext';

type Props = NativeStackScreenProps<HelperStackParamList, 'HelperHome'>;

type OfferRowProps = {
  offer: TaskOfferedEvent;
  onAccept: (taskId: string) => void;
  loading: boolean;
  disabled: boolean;
};

const SORT_OPTIONS: Array<{ key: 'distance' | 'time' | 'budget'; labelKey: string }> = [
  { key: 'distance', labelKey: 'helper.sort.distance' },
  { key: 'time', labelKey: 'helper.sort.time' },
  { key: 'budget', labelKey: 'helper.sort.budget' },
];

const OFFERS_STORAGE_KEY = 'superheroo.helper.offers';
const ACTIVE_TASK_STATUSES: TaskStatus[] = ['ASSIGNED', 'ARRIVED', 'STARTED'];

function normalizeOffer(raw: TaskOfferedEvent): TaskOfferedEvent {
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  const distanceMeters = Number(raw.distanceMeters);
  const budgetPaise = Number(raw.budgetPaise);
  const timeMinutes = Number(raw.timeMinutes);
  return {
    ...raw,
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
    distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : 0,
    budgetPaise: Number.isFinite(budgetPaise) ? budgetPaise : 0,
    timeMinutes: Number.isFinite(timeMinutes) ? timeMinutes : 0,
  };
}

function isOfferExpired(offer: TaskOfferedEvent) {
  if (!offer.expiresAt) return false;
  const ts = new Date(offer.expiresAt).getTime();
  return Number.isFinite(ts) && ts <= Date.now();
}

const OfferRow = React.memo(function OfferRow({ offer, onAccept, loading, disabled }: OfferRowProps) {
  const { t } = useI18n();
  const onPress = useCallback(() => onAccept(offer.taskId), [offer.taskId, onAccept]);
  const km = Math.max(0, Number(offer.distanceMeters) / 1000).toFixed(1);
  const budget = (Number(offer.budgetPaise) / 100).toFixed(0);
  const urgencyLabel = useMemo(() => {
    switch (offer.urgency) {
      case 'LOW':
        return t('urgency.low');
      case 'NORMAL':
        return t('urgency.normal');
      case 'HIGH':
        return t('urgency.high');
      case 'CRITICAL':
        return t('urgency.critical');
      default:
        return offer.urgency;
    }
  }, [offer.urgency, t]);
  return (
    <View style={styles.offerRow}>
      <Text style={styles.offerTitle}>{offer.title}</Text>
      <Text style={styles.offerMeta}>{offer.description}</Text>
      <Text style={styles.offerMeta}>
        {t('helper.offer.urgency')}: {urgencyLabel} | {t('helper.offer.eta')}: {offer.timeMinutes} {t('buyer.task.minutes')} | {t('helper.offer.budget')}: {t('currency.inr')} {budget}
      </Text>
      <Text style={styles.offerMeta}>{km} {t('helper.km_away')}</Text>
      <PrimaryButton
        label={t('helper.accept')}
        onPress={onPress}
        loading={loading}
        disabled={disabled}
        leftIcon={<MaterialCommunityIcons name="handshake" size={18} color={theme.colors.primaryText} />}
      />
    </View>
  );
});

export function HelperHomeScreen({ navigation }: Props) {
  const { user, withAuth } = useAuth();
  const { t } = useI18n();
  const socket = useSocket();
  const online = useIsOnline();
  const { isOnline, setOnline, setLastCoords } = useHelperPresence();
  const { activeTaskId, setActiveTaskId } = useActiveTask();

  const [profile, setProfile] = useState<HelperProfile | null>(null);
  const [offers, setOffers] = useState<TaskOfferedEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [autoKycDone, setAutoKycDone] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'time' | 'budget'>('distance');
  const [sortOpen, setSortOpen] = useState(false);
  const [acceptingTaskId, setAcceptingTaskId] = useState<string | null>(null);

  const lastCoords = useRef<{ lat: number; lng: number } | null>(null);
  const announcedTaskIds = useRef<Set<string>>(new Set());

  const persistOffers = useCallback(async (next: TaskOfferedEvent[]) => {
    await AsyncStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const loadOffersFromStorage = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(OFFERS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as TaskOfferedEvent[];
      const normalized = Array.isArray(parsed) ? parsed.map(normalizeOffer).filter((o) => !isOfferExpired(o)) : [];
      setOffers(normalized);
    } catch {
      // ignore
    }
  }, []);

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
    const sub = Notifications.addNotificationReceivedListener((event) => {
      const type = event.request?.content?.data?.type;
      if (type === 'KYC_APPROVED') {
        setNotice(t('helper.kyc.approved'));
        loadProfile();
      }
    });
    return () => sub.remove();
  }, [loadProfile, t]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      loadProfile();
      loadOffersFromStorage();
    });
    return unsub;
  }, [loadOffersFromStorage, loadProfile, navigation]);

  const notifyLocalTask = useCallback(
    async (offer: TaskOfferedEvent) => {
      if (!offer?.taskId || announcedTaskIds.current.has(offer.taskId)) return;
      announcedTaskIds.current.add(offer.taskId);
      const amountInr = Math.max(0, Math.round((offer.budgetPaise ?? 0) / 100));
      const distanceKm = Math.max(0, (offer.distanceMeters ?? 0) / 1000);
      const distanceText = distanceKm < 1 ? `${Math.round(offer.distanceMeters ?? 0)} m` : `${distanceKm.toFixed(1)} km`;
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: t('helper.nearby_tasks'),
            body: `${offer.title} • ₹${amountInr} • ${distanceText}`,
            data: { type: 'TASK_OFFERED', taskId: offer.taskId },
          },
          trigger: null,
        });
      } catch {
        // best effort
      }
    },
    [t],
  );

  const openActiveTaskIfAny = useCallback(async () => {
    const mine = await withAuth((t) => api.listMyTasks(t));
    const active = Array.isArray(mine)
      ? mine.find((task) => ACTIVE_TASK_STATUSES.includes(task.status))
      : null;
    if (!active?.id) {
      if (activeTaskId) {
        await setActiveTaskId(null);
      }
      return false;
    }
    await setActiveTaskId(active.id);
    setOffers([]);
    await persistOffers([]);
    if (navigation.isFocused()) {
      navigation.navigate('HelperTask', { taskId: active.id });
    }
    return true;
  }, [activeTaskId, navigation, persistOffers, setActiveTaskId, withAuth]);

  const loadValidTasks = useCallback(async () => {
    try {
      if (!isOnline) return;
      const hasActive = await openActiveTaskIfAny();
      if (hasActive) {
        return;
      }
      const available = await withAuth((t) => api.helperGetAvailableTasks(t));
      if (!Array.isArray(available)) return;

      const toEvent = (t: import('../../api/types').Task): TaskOfferedEvent => ({
        helperId: user?.id ?? '', // We don't dispatch direct offers here, just list them
        taskId: t.id,
        title: t.title,
        description: t.description ?? '',
        urgency: t.urgency,
        timeMinutes: t.timeMinutes,
        budgetPaise: t.budgetPaise,
        distanceMeters: (t as any).distanceMeters ?? 0,
        lat: t.lat,
        lng: t.lng,
        expiresAt: null
      });

      // replace the entire list with fresh data – keeping old tasks around
      // caused stale/unassigned tasks to linger and break realtime behaviour.
      const newOffers = Array.from(
        new Map(available.map(toEvent).map((offer) => [offer.taskId, offer])).values(),
      ).slice(0, 20);
      setOffers((prev) => {
        const prevIds = new Set(prev.map((o) => o.taskId));
        for (const offer of newOffers) {
          if (!prevIds.has(offer.taskId)) {
            void notifyLocalTask(offer);
          }
        }
        persistOffers(newOffers).catch(() => {});
        return newOffers;
      });
    } catch {
      // ignore silently
    }
  }, [isOnline, notifyLocalTask, openActiveTaskIfAny, persistOffers, withAuth]);

  useEffect(() => {
    loadOffersFromStorage();
  }, [loadOffersFromStorage]);

  useEffect(() => {
    loadValidTasks();
  }, [loadValidTasks]);

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
      setNotice(t('common.offline'));
      return false;
    }
    if (profile && profile.kycStatus !== 'APPROVED') {
      setNotice(t('helper.kyc.must_complete'));
      return false;
    }

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (DEMO_FALLBACK_LOCATION) {
          const { lat, lng } = DEMO_FALLBACK_LOCATION;
          lastCoords.current = { lat, lng };
          await withAuth((t) => api.helperSetOnline(t, true, lat, lng));
          setNotice(t('error.gps_unavailable'));
          await setLastCoords({ lat, lng });
          await setOnline(true);
          setOffers([]);
          await persistOffers([]);
          return true;
        }
        setNotice(t('error.location_unavailable'));
        return false;
      }

      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        if (DEMO_FALLBACK_LOCATION) {
          const { lat, lng } = DEMO_FALLBACK_LOCATION;
          lastCoords.current = { lat, lng };
          await withAuth((t) => api.helperSetOnline(t, true, lat, lng));
          setNotice(t('error.location_permission_fallback'));
          await setLastCoords({ lat, lng });
          await setOnline(true);
          setOffers([]);
          await persistOffers([]);
          return true;
        }
        setNotice(t('error.location_permission'));
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
      await setLastCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      await setOnline(true);
      setOffers([]);
      await persistOffers([]);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setNotice(t('helper.kyc.pending'));
        return false;
      }
      if (DEMO_FALLBACK_LOCATION) {
        const { lat, lng } = DEMO_FALLBACK_LOCATION;
        try {
          lastCoords.current = { lat, lng };
          await withAuth((t) => api.helperSetOnline(t, true, lat, lng));
        setNotice(t('error.location_fallback'));
          await setLastCoords({ lat, lng });
          await setOnline(true);
          setOffers([]);
          await persistOffers([]);
          return true;
        } catch {
          // fall through
        }
      }
      setError(t('helper.go_online_error'));
      return false;
    }
  }, [online, profile, t, withAuth]);

  const goOffline = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      await withAuth((t) => api.helperSetOnline(t, false));
    } catch {
      // best-effort
    }
    await setOnline(false);
    setOffers([]);
    await persistOffers([]);
  }, [persistOffers, setOnline, withAuth]);

  const toggleOnline = useCallback(async () => {
    if (isOnline) {
      await goOffline();
    } else {
      await goOnline();
    }
  }, [goOffline, goOnline, isOnline]);

  const acceptOffer = useCallback(
    async (taskId: string) => {
      if (acceptingTaskId || activeTaskId) return;
      setError(null);
      setNotice(null);
      setAcceptingTaskId(taskId);
      try {
        await withAuth((t) => api.acceptTask(t, taskId));
        await setActiveTaskId(taskId);
        setOffers([]);
        await persistOffers([]);
        navigation.navigate('HelperTask', { taskId });
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          if (e.message?.toLowerCase().includes('finish your current task')) {
            const found = await openActiveTaskIfAny();
            if (found) {
              setNotice(t('helper.active_task_only'));
              return;
            }
          }
          setNotice(t('helper.offer_expired'));
          setOffers((prev) => {
            const next = prev.filter((o) => o.taskId !== taskId);
            persistOffers(next).catch(() => { });
            return next;
          });
          return;
        }
        setError(t('helper.accept_error'));
      } finally {
        setAcceptingTaskId(null);
      }
    },
    [acceptingTaskId, activeTaskId, navigation, openActiveTaskIfAny, persistOffers, setActiveTaskId, t, withAuth],
  );

  useEffect(() => {
    if (!socket) return;
    const onOffered = (evt: TaskOfferedEvent) => {
      if (activeTaskId) return;
      if (!evt || !evt.taskId) return;
      if (evt.helperId && user?.id && evt.helperId !== user.id) return;
      const normalized = normalizeOffer(evt);
      if (isOfferExpired(normalized)) return;
      setOffers((prev) => {
        if (prev.some((p) => p.taskId === normalized.taskId)) return prev;
        const next = [normalized, ...prev].slice(0, 20);
        persistOffers(next).catch(() => { });
        return next;
      });
      void notifyLocalTask(normalized);
    };
    const onTaskCreated = () => {
      // When a new task is created, refresh available tasks so helper sees it
      loadValidTasks();
    };
    const removeTaskOffer = (taskId?: string | null) => {
      if (!taskId) return;
      setOffers((prev) => {
        if (!prev.some((o) => o.taskId === taskId)) return prev;
        const next = prev.filter((o) => o.taskId !== taskId);
        persistOffers(next).catch(() => {});
        return next;
      });
    };
    const onTaskAssigned = (evt: { taskId?: string; helperId?: string | null }) => {
      removeTaskOffer(evt?.taskId);
      if (evt?.taskId && evt?.helperId && user?.id && evt.helperId === user.id) {
        setActiveTaskId(evt.taskId).catch(() => {});
      }
    };
    const onTaskStatus = (evt: { taskId?: string; status?: string | null }) => {
      if (!evt?.taskId) return;
      if (evt.status && evt.status !== 'SEARCHING') {
        removeTaskOffer(evt.taskId);
      }
    };
    const onConnected = () => {
      if (isOnline) {
        loadValidTasks();
      }
    };
    socket.on('task.offered', onOffered);
    socket.on('task_created', onTaskCreated);
    socket.on('task_assigned', onTaskAssigned);
    socket.on('task.assigned', onTaskAssigned);
    socket.on('task_status_changed', onTaskStatus);
    socket.on('task.status.changed', onTaskStatus);
    socket.on('connect', onConnected);
    socket.on('reconnect', onConnected);
    return () => {
      socket.off('task.offered', onOffered);
      socket.off('task_created', onTaskCreated);
      socket.off('task_assigned', onTaskAssigned);
      socket.off('task.assigned', onTaskAssigned);
      socket.off('task_status_changed', onTaskStatus);
      socket.off('task.status.changed', onTaskStatus);
      socket.off('connect', onConnected);
      socket.off('reconnect', onConnected);
    };
  }, [activeTaskId, isOnline, loadValidTasks, notifyLocalTask, persistOffers, setActiveTaskId, socket, user?.id]);

  useEffect(() => {
    if (!isOnline) return;
    const timer = setInterval(() => {
      loadValidTasks();
    }, 20_000);
    return () => clearInterval(timer);
  }, [isOnline, loadValidTasks]);

  useEffect(() => {
    const timer = setInterval(() => {
      setOffers((prev) => {
        const next = prev.filter((o) => !isOfferExpired(o));
        if (next.length !== prev.length) {
          persistOffers(next).catch(() => { });
        }
        return next;
      });
    }, 10_000);
    return () => clearInterval(timer);
  }, [persistOffers]);

  const sortedOffers = useMemo(() => {
    const list = [...offers];
    if (sortBy === 'time') {
      list.sort((a, b) => (a.timeMinutes ?? 0) - (b.timeMinutes ?? 0));
    } else if (sortBy === 'budget') {
      list.sort((a, b) => (b.budgetPaise ?? 0) - (a.budgetPaise ?? 0));
    } else {
      list.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    }
    return list;
  }, [offers, sortBy]);

  const sortLabel = useMemo(() => {
    const opt = SORT_OPTIONS.find((o) => o.key === sortBy);
    return opt ? t(opt.labelKey) : t('helper.sort.distance');
  }, [sortBy, t]);

  const visibleOffers = useMemo(() => {
    if (activeTaskId) return [];
    return sortedOffers.filter((o) => !isOfferExpired(o));
  }, [activeTaskId, sortedOffers]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.h1}>{t('tabs.tasks')}</Text>
        <View style={styles.topLinks}>
          <Text onPress={() => navigation.navigate('SupportTickets')} style={styles.link}>{t('buyer.support')}</Text>
          <Text onPress={() => navigation.navigate('Profile')} style={styles.link}>{t('menu.profile')}</Text>
        </View>
      </View>

      {!online ? <Notice kind="warning" text={t('buyer.offline')} /> : null}
      {profile?.kycStatus === 'PENDING' ? (
        <Notice kind="warning" text={t('helper.kyc.pending')} />
      ) : null}
      {profile?.kycStatus === 'APPROVED' ? (
        <Notice kind="success" text={t('helper.kyc.approved')} />
      ) : null}
      {profile?.kycStatus === 'REJECTED' ? (
        <Notice kind="danger" text={`${t('helper.kyc.rejected')}${profile.kycRejectionReason ? `: ${profile.kycRejectionReason}` : ''}`} />
      ) : null}
      {notice ? <Notice kind="warning" text={notice} /> : null}
      {error ? <Notice kind="danger" text={error} /> : null}
      {activeTaskId ? <Notice kind="info" text={t('helper.active_task_only')} /> : null}

      <View style={styles.card}>
        <Text style={styles.section}>{t('helper.availability')}</Text>
        <View style={styles.actionsRow}>
          <PrimaryButton
            label={t('helper.complete_kyc')}
            onPress={() => navigation.navigate('HelperKyc')}
            variant="ghost"
            style={styles.half}
            leftIcon={<MaterialCommunityIcons name="shield-check" size={18} color={theme.colors.primary} />}
          />
          <PrimaryButton
            label={isOnline ? t('helper.offline') : t('helper.online')}
            onPress={toggleOnline}
            variant={isOnline ? 'danger' : 'primary'}
            style={styles.half}
            leftIcon={
              <MaterialCommunityIcons
                name={isOnline ? 'toggle-switch-off-outline' : 'toggle-switch-outline'}
                size={18}
                color={theme.colors.primaryText}
              />
            }
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>{t('helper.nearby_tasks')}</Text>
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>{t('helper.sort_by')}</Text>
          <Pressable style={styles.sortDropdown} onPress={() => setSortOpen(true)}>
            <Text style={styles.sortValue}>{sortLabel}</Text>
            <Text style={styles.sortCaret}>▾</Text>
          </Pressable>
        </View>
        <FlatList
          data={visibleOffers}
          keyExtractor={(o) => o.taskId}
          renderItem={({ item }) => (
            <OfferRow
              offer={item}
              onAccept={acceptOffer}
              loading={acceptingTaskId === item.taskId}
              disabled={Boolean(acceptingTaskId && acceptingTaskId !== item.taskId)}
            />
          )}
          contentContainerStyle={styles.offerList}
          initialNumToRender={6}
          windowSize={6}
          ListEmptyComponent={
            <Text style={styles.muted}>
              {activeTaskId
                ? t('helper.active_task_only')
                : isOnline
                  ? t('helper.no_offers')
                  : t('helper.go_online_receive')}
            </Text>
          }
        />
      </View>

      <Modal transparent visible={sortOpen} animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSortOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('helper.sort_tasks')}</Text>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[styles.modalOption, sortBy === opt.key ? styles.modalOptionActive : null]}
                onPress={() => {
                  setSortBy(opt.key);
                  setSortOpen(false);
                }}
              >
                <Text style={styles.modalOptionText}>{t(opt.labelKey)}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: theme.space.xl },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topLinks: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  h1: { color: theme.colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
  link: { color: theme.colors.primary, fontWeight: '800' },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.space.md + 2,
    gap: theme.space.sm,
    ...theme.shadow.lifted,
  },
  section: { color: theme.colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.25 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  sortLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '700' },
  sortDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    ...theme.shadow.card,
  },
  sortValue: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  sortCaret: { color: theme.colors.muted, fontSize: 14, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: theme.space.sm, marginTop: 8 },
  half: { flex: 1 },
  offerList: { gap: 12, paddingTop: 6 },
  offerRow: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.space.md + 2,
    gap: 10,
    backgroundColor: theme.colors.card,
    ...theme.shadow.lifted,
  },
  offerTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '800', lineHeight: 20 },
  offerMeta: { color: theme.colors.muted, fontSize: 12 },
  muted: { color: theme.colors.muted },
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.lifted,
  },
  modalTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  modalOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  modalOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceSoft,
  },
  modalOptionText: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
});
