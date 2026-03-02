import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Voice from '@react-native-voice/voice';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TaskUrgency } from '../../api/types';
import * as api from '../../api/client';
import { ApiError } from '../../api/http';
import { useAuth } from '../../auth/AuthContext';
import { useIsOnline } from '../../hooks/useIsOnline';
import { Screen } from '../../ui/Screen';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { TextField } from '../../ui/TextField';
import { Notice } from '../../ui/Notice';
import { Segmented } from '../../ui/Segmented';
import { MenuButton } from '../../ui/MenuButton';
import { theme } from '../../ui/theme';
import { DEMO_FALLBACK_LOCATION, GOOGLE_MAPS_API_KEY } from '../../config';
import type { BuyerStackParamList } from '../../navigation/types';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<BuyerStackParamList, 'BuyerHome'>;

const URGENCY_OPTIONS: { label: string; key: TaskUrgency }[] = [
  { label: 'Low', key: 'LOW' },
  { label: 'Normal', key: 'NORMAL' },
  { label: 'High', key: 'HIGH' },
  { label: 'Critical', key: 'CRITICAL' },
];

export function BuyerHomeScreen({ navigation }: Props) {
  const { withAuth } = useAuth();
  const { t } = useI18n();
  const online = useIsOnline();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [addressText, setAddressText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [autoSearchBusy, setAutoSearchBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ placeId: string; description: string }>>([]);
  const [timeMinutes, setTimeMinutes] = useState('30');
  const [budgetRupees, setBudgetRupees] = useState('150');
  const [urgency, setUrgency] = useState<TaskUrgency>('NORMAL');
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRenderMap = Boolean(GOOGLE_MAPS_API_KEY);
  const mapProvider = canRenderMap ? PROVIDER_GOOGLE : undefined;

  const titleOk = useMemo(() => title.trim().length >= 3, [title]);
  const descOk = useMemo(() => description.trim().length >= 10, [description]);
  const timeOk = useMemo(() => Number.isFinite(Number(timeMinutes)) && Number(timeMinutes) >= 1, [timeMinutes]);
  const budgetOk = useMemo(() => Number.isFinite(Number(budgetRupees)) && Number(budgetRupees) >= 0, [budgetRupees]);
  const canCreate = useMemo(
    () => Boolean(online && titleOk && descOk && timeOk && budgetOk && lat != null && lng != null),
    [budgetOk, descOk, lat, lng, online, timeOk, titleOk],
  );

  const lastLocationTs = useRef<number>(0);
  const voiceActiveRef = useRef(false);

  const resolveAddress = useCallback(async (latitude: number, longitude: number) => {
    try {
      const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (rev && rev.length > 0) {
        const first = rev[0];
        const parts = [first.name, first.street, first.city, first.region].filter(Boolean);
        if (parts.length > 0) {
          setAddressText(parts.join(', '));
        }
      }
    } catch {
      // Best-effort only.
    }
  }, []);

  const onMapPress = useCallback(
    (evt: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = evt.nativeEvent.coordinate;
      setLat(latitude);
      setLng(longitude);
      resolveAddress(latitude, longitude);
    },
    [resolveAddress],
  );

  const refreshLocation = useCallback(async () => {
    setLocError(null);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (DEMO_FALLBACK_LOCATION) {
          setLat(DEMO_FALLBACK_LOCATION.lat);
          setLng(DEMO_FALLBACK_LOCATION.lng);
          setLocError('GPS unavailable. Using demo fallback location.');
          return;
        }
        setLocError('Location is turned off. Enable Location in device settings and try again.');
        return;
      }

      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        if (DEMO_FALLBACK_LOCATION) {
          setLat(DEMO_FALLBACK_LOCATION.lat);
          setLng(DEMO_FALLBACK_LOCATION.lng);
          setLocError('Location permission not granted. Using demo fallback location.');
          return;
        }
        setLocError('Location permission is required to create a task.');
        return;
      }

      try {
        const st = await Location.getProviderStatusAsync();
        if (st.locationServicesEnabled && st.gpsAvailable === false && st.networkAvailable === false) {
          await Location.enableNetworkProviderAsync();
        }
      } catch {
        // best effort
      }

      const now = Date.now();
      if (now - lastLocationTs.current < 4_000) return;
      lastLocationTs.current = now;

      const last = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000, requiredAccuracy: 2_000 });
      if (last?.coords) {
        setLat(last.coords.latitude);
        setLng(last.coords.longitude);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string'
          ? (e as any).message
          : null;
      if (DEMO_FALLBACK_LOCATION) {
        setLat(DEMO_FALLBACK_LOCATION.lat);
        setLng(DEMO_FALLBACK_LOCATION.lng);
        setLocError('Current location unavailable. Using demo fallback location.');
        return;
      }
      setLocError(msg ? `Could not get your location: ${msg}` : 'Could not get your location. Try again.');
    }
  }, []);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  useFocusEffect(
    useCallback(() => {
      refreshLocation();
      return undefined;
    }, [refreshLocation]),
  );

  useEffect(() => {
    Voice.onSpeechResults = (event) => {
      const text = event.value?.[0] ?? '';
      if (text) {
        setDescription((prev) => (prev ? `${prev} ${text}` : text));
      }
    };
    Voice.onSpeechPartialResults = (event) => {
      const text = event.value?.[0] ?? '';
      if (text) {
        setDescription((prev) => (prev ? `${prev} ${text}` : text));
      }
    };
    Voice.onSpeechError = () => {
      setVoiceError('Voice input failed. Please try again.');
      setVoiceActive(false);
      voiceActiveRef.current = false;
    };
    Voice.onSpeechEnd = () => {
      setVoiceActive(false);
      voiceActiveRef.current = false;
    };
    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const searchLocation = useCallback(async () => {
    if (!searchQuery.trim()) return;
    if (!GOOGLE_MAPS_API_KEY) {
      setError('Google Maps API key is missing. Please add it to the app config.');
      return;
    }
    setSearchBusy(true);
    setError(null);
    try {
      const url =
        'https://maps.googleapis.com/maps/api/place/findplacefromtext/json' +
        `?input=${encodeURIComponent(searchQuery.trim())}` +
        '&inputtype=textquery&fields=geometry,formatted_address,name' +
        `&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
      const res = await fetch(url);
      const json = await res.json();
      const candidate = json?.candidates?.[0];
      const loc = candidate?.geometry?.location;
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        setLat(loc.lat);
        setLng(loc.lng);
        if (candidate.formatted_address) {
          setAddressText(candidate.formatted_address);
        } else if (candidate.name) {
          setAddressText(candidate.name);
        } else {
          resolveAddress(loc.lat, loc.lng);
        }
        setSuggestions([]);
      } else {
        setError('Location not found. Try a different search.');
      }
    } catch {
      setError('Could not search location. Check your network and try again.');
    } finally {
      setSearchBusy(false);
    }
  }, [searchQuery, resolveAddress]);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!GOOGLE_MAPS_API_KEY) return;
      setAutoSearchBusy(true);
      try {
        const url =
          'https://maps.googleapis.com/maps/api/place/autocomplete/json' +
          `?input=${encodeURIComponent(query)}` +
          '&types=geocode' +
          `&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
        const res = await fetch(url);
        const json = await res.json();
        const preds = Array.isArray(json?.predictions) ? json.predictions : [];
        const trimmed = preds.slice(0, 6).map((p: any) => ({
          placeId: p.place_id,
          description: p.description,
        }));
        setSuggestions(trimmed);
      } catch {
        setSuggestions([]);
      } finally {
        setAutoSearchBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return undefined;
    }
    const t = setTimeout(() => {
      fetchSuggestions(q);
    }, 350);
    return () => clearTimeout(t);
  }, [fetchSuggestions, searchQuery]);

  const selectSuggestion = useCallback(
    async (placeId: string, description: string) => {
      if (!GOOGLE_MAPS_API_KEY) return;
      setError(null);
      setSearchBusy(true);
      setSuggestions([]);
      setSearchQuery(description);
      try {
        const url =
          'https://maps.googleapis.com/maps/api/place/details/json' +
          `?place_id=${encodeURIComponent(placeId)}` +
          '&fields=geometry,formatted_address,name' +
          `&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
        const res = await fetch(url);
        const json = await res.json();
        const result = json?.result;
        const loc = result?.geometry?.location;
        if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
          setLat(loc.lat);
          setLng(loc.lng);
          if (result.formatted_address) {
            setAddressText(result.formatted_address);
          } else if (result.name) {
            setAddressText(result.name);
          } else {
            resolveAddress(loc.lat, loc.lng);
          }
        }
      } catch {
        setError('Could not fetch location details. Try again.');
      } finally {
        setSearchBusy(false);
      }
    },
    [resolveAddress],
  );

  const onCreate = useCallback(async () => {
    if (!canCreate || busy || lat == null || lng == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await withAuth((t) =>
        api.createTask(t, {
          title: title.trim(),
          description: description.trim(),
          urgency,
          timeMinutes: Number(timeMinutes),
          budgetPaise: Math.round(Number(budgetRupees) * 100),
          lat,
          lng,
          addressText: addressText.trim() || null,
        }),
      );
      navigation.navigate('BuyerTask', { taskId: res.taskId });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      if (e instanceof ApiError) {
        setError(e.message || `Could not create task (${e.status}).`);
      } else {
        setError('Could not create task. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [addressText, budgetRupees, busy, canCreate, description, lat, lng, navigation, timeMinutes, title, urgency, withAuth]);

  const toggleVoice = useCallback(async () => {
    setVoiceError(null);
    if (voiceActiveRef.current) {
      await Voice.stop();
      setVoiceActive(false);
      voiceActiveRef.current = false;
      return;
    }
    try {
      await Voice.start('en-IN');
      setVoiceActive(true);
      voiceActiveRef.current = true;
    } catch {
      setVoiceError('Voice input unavailable. Check mic permission.');
      setVoiceActive(false);
      voiceActiveRef.current = false;
    }
  }, []);

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.kav}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: theme.space.xl * 3 + Math.max(insets.bottom, theme.space.lg) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <MenuButton onPress={() => navigation.navigate('Menu')} />
            <Text style={styles.h1}>{t('buyer.create_task')}</Text>
            <View style={styles.topLinks} />
          </View>

          {!online ? <Notice kind="warning" text={t('buyer.offline')} /> : null}
          {locError ? <Notice kind="warning" text={locError} /> : null}
          {error ? <Notice kind="danger" text={error} /> : null}
          {voiceError ? <Notice kind="danger" text={voiceError} /> : null}

          <View style={styles.card}>
            <Text style={styles.section}>{t('buyer.pickup_location')}</Text>
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <TextField
                label={t('buyer.search_location')}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('buyer.search_location')}
              />
            </View>
            <PrimaryButton label={t('buyer.search')} onPress={searchLocation} loading={searchBusy} style={styles.searchBtn} />
          </View>
          {autoSearchBusy ? <Text style={styles.muted}>Searching suggestions…</Text> : null}
          {suggestions.length > 0 ? (
            <View style={styles.suggestions}>
              {suggestions.map((s) => (
                <Pressable key={s.placeId} style={styles.suggestionRow} onPress={() => selectSuggestion(s.placeId, s.description)}>
                  <Text style={styles.suggestionText}>{s.description}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {addressText ? (
            <View style={styles.addressBox}>
              <Text style={styles.addressLabel}>Selected address</Text>
              <Text style={styles.addressValue}>{addressText}</Text>
            </View>
          ) : null}

            {canRenderMap ? (
              <View style={styles.mapWrap}>
                <MapView
                  style={styles.map}
                  provider={mapProvider}
                  onPress={onMapPress}
                  initialRegion={{
                    latitude: lat ?? DEMO_FALLBACK_LOCATION?.lat ?? 12.9716,
                    longitude: lng ?? DEMO_FALLBACK_LOCATION?.lng ?? 77.5946,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  region={
                    lat != null && lng != null
                      ? {
                          latitude: lat,
                          longitude: lng,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        }
                      : undefined
                  }
                >
                  {lat != null && lng != null ? (
                    <Marker coordinate={{ latitude: lat, longitude: lng }} title="Pickup location" />
                  ) : null}
                </MapView>
              </View>
            ) : (
              <Notice kind="warning" text="Map unavailable: missing Google Maps API key." />
            )}

            <Text style={styles.section}>{t('buyer.task_details')}</Text>
            <TextField label={t('buyer.task_name')} value={title} onChangeText={setTitle} placeholder={t('buyer.task_name_placeholder')} />
            <View style={styles.voiceRow}>
              <TextField
                label={t('buyer.description')}
                value={description}
                onChangeText={setDescription}
                placeholder={t('buyer.description_placeholder')}
                multiline
              />
              <PrimaryButton
                label={voiceActive ? t('buyer.voice_stop') : t('buyer.voice_start')}
                onPress={toggleVoice}
                variant="ghost"
                style={styles.voiceBtn}
              />
            </View>
            <TextField label={t('buyer.expected_time')} value={timeMinutes} onChangeText={setTimeMinutes} keyboardType="number-pad" />
            <TextField label={t('buyer.budget')} value={budgetRupees} onChangeText={setBudgetRupees} keyboardType="number-pad" />
            <Segmented options={URGENCY_OPTIONS} value={urgency} onChange={(v) => setUrgency(v as TaskUrgency)} />
            <TextField
              label={t('buyer.address_optional')}
              value={addressText}
              onChangeText={setAddressText}
              placeholder={t('buyer.address_placeholder')}
              multiline
            />

            <View
              style={[
                styles.actionsRow,
                { paddingBottom: Math.max(insets.bottom + theme.space.md, theme.space.lg), marginBottom: theme.space.md },
              ]}
            >
              <PrimaryButton label={t('buyer.refresh_location')} onPress={refreshLocation} variant="ghost" style={styles.half} />
              <PrimaryButton label={t('buyer.create_task_btn')} onPress={onCreate} disabled={!canCreate} loading={busy} style={styles.half} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  screen: { padding: 0, gap: 0 },
  scrollContent: { padding: theme.space.lg, gap: theme.space.md, paddingBottom: theme.space.xl * 2 },
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
  voiceRow: { gap: theme.space.xs },
  voiceBtn: { alignSelf: 'flex-start' },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.space.sm },
  searchField: { flex: 1 },
  searchBtn: { alignSelf: 'flex-end' },
  mapWrap: { height: 200, borderRadius: theme.radius.md, overflow: 'hidden' },
  map: { flex: 1 },
  section: { color: theme.colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.25 },
  suggestions: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  suggestionText: { color: theme.colors.text, fontSize: 14 },
  addressBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.space.sm,
    backgroundColor: '#F8FAFF',
    gap: 6,
  },
  addressLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '800' },
  addressValue: { color: theme.colors.text, fontSize: 13, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: theme.space.sm, marginTop: 8 },
  half: { flex: 1 },
});
