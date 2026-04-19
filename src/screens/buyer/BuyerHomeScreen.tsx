import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Voice from '@react-native-voice/voice';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
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
import { theme } from '../../ui/theme';
import { DEMO_FALLBACK_LOCATION, GOOGLE_MAPS_API_KEY } from '../../config';
import type { BuyerStackParamList } from '../../navigation/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useActiveTask } from '../../state/ActiveTaskContext';

type Props = NativeStackScreenProps<BuyerStackParamList, 'BuyerHome'>;

type LocationSuggestion = {
  placeId: string;
  description: string;
  source: 'osm' | 'google';
  lat?: number;
  lng?: number;
};

const URGENCY_OPTIONS: { labelKey: string; key: TaskUrgency }[] = [
  { labelKey: 'urgency.low', key: 'LOW' },
  { labelKey: 'urgency.normal', key: 'NORMAL' },
  { labelKey: 'urgency.high', key: 'HIGH' },
  { labelKey: 'urgency.critical', key: 'CRITICAL' },
];

const SCHEDULE_OPTIONS = [
  { key: 'now', labelKey: 'schedule.now' },
  { key: 'later', labelKey: 'schedule.later' },
];

const HYDERABAD = { lat: 17.385, lng: 78.4867 };
const HYDERABAD_RADIUS_KM = 55;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 6371 * (2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)));
}

function isHyderabadLocation(lat: number, lng: number): boolean {
  return haversineKm(lat, lng, HYDERABAD.lat, HYDERABAD.lng) <= HYDERABAD_RADIUS_KM;
}

function toYmd(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toHm(value: Date): string {
  const h = String(value.getHours()).padStart(2, '0');
  const m = String(value.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function estimateSuggestedPriceInr(
  title: string,
  description: string,
  timeMinutes: number,
  urgency: TaskUrgency,
): number {
  const t = `${title} ${description}`.toLowerCase();
  let score = 0;
  if (/(repair|plumb|electric|wiring|ac|fridge|washing|leak|fix)/.test(t)) score += 3;
  if (/(lift|heavy|move|shift|furniture|loading|unloading)/.test(t)) score += 2;
  if (/(clean|deep clean|sanitize|bathroom|kitchen)/.test(t)) score += 2;
  if (/(urgent|asap|immediately|now)/.test(t)) score += 1;

  const minutes = Math.max(1, Math.min(480, timeMinutes || 1));
  const base = minutes * 6;
  const complexity = score * 35;
  const urgencyFactor =
    urgency === 'CRITICAL' ? 1.35 : urgency === 'HIGH' ? 1.2 : urgency === 'LOW' ? 0.9 : 1.0;
  const suggested = Math.max(80, Math.round((base + complexity) * urgencyFactor));
  return suggested;
}

export function BuyerHomeScreen({ navigation }: Props) {
  const { withAuth } = useAuth();
  const { t } = useI18n();
  const { setActiveTaskId } = useActiveTask();
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [addressText, setAddressText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [autoSearchBusy, setAutoSearchBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [timeMinutes, setTimeMinutes] = useState('30');
  const [budgetRupees, setBudgetRupees] = useState('150');
  const [helperCount, setHelperCount] = useState('1');
  const [urgency, setUrgency] = useState<TaskUrgency>('NORMAL');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduleAt, setScheduleAt] = useState<Date | null>(null);
  const [scheduleTouched, setScheduleTouched] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRenderMap = Boolean(GOOGLE_MAPS_API_KEY);
  const mapProvider = canRenderMap ? PROVIDER_GOOGLE : undefined;
  const urgencyOptions = useMemo(
    () => URGENCY_OPTIONS.map((opt) => ({ key: opt.key, label: t(opt.labelKey) })),
    [t],
  );
  const scheduleOptions = useMemo(
    () => SCHEDULE_OPTIONS.map((opt) => ({ key: opt.key, label: t(opt.labelKey) })),
    [t],
  );

  const titleOk = useMemo(() => title.trim().length >= 3, [title]);
  const descOk = useMemo(() => description.trim().length >= 10, [description]);
  const timeOk = useMemo(() => Number.isFinite(Number(timeMinutes)) && Number(timeMinutes) >= 1, [timeMinutes]);
  const budgetOk = useMemo(() => Number.isFinite(Number(budgetRupees)) && Number(budgetRupees) >= 0, [budgetRupees]);
  const helperCountOk = useMemo(
    () => Number.isFinite(Number(helperCount)) && Number(helperCount) >= 1 && Number(helperCount) <= 25,
    [helperCount],
  );
  const scheduledAt = useMemo(() => {
    if (scheduleMode !== 'later') return null;
    return scheduleAt;
  }, [scheduleAt, scheduleMode]);
  const scheduleOk = useMemo(() => {
    if (scheduleMode !== 'later') return true;
    if (!scheduledAt) return false;
    return scheduledAt.getTime() > Date.now() + 60_000;
  }, [scheduleMode, scheduledAt]);
  const canCreate = useMemo(
    () => Boolean(online && titleOk && descOk && timeOk && budgetOk && helperCountOk && scheduleOk && lat != null && lng != null),
    [budgetOk, descOk, helperCountOk, lat, lng, online, scheduleOk, timeOk, titleOk],
  );
  const pricing = useMemo(() => {
    const minutes = Number(timeMinutes);
    const entered = Number(budgetRupees);
    if (!Number.isFinite(minutes) || minutes <= 0) return null;
    if (!Number.isFinite(entered) || entered < 0) return null;
    const suggested = estimateSuggestedPriceInr(title.trim(), description.trim(), minutes, urgency);
    const ratio = suggested > 0 ? entered / suggested : 1;
    const verdict = ratio < 0.85 ? 'low' : ratio > 1.2 ? 'high' : 'fair';
    return { suggested, verdict };
  }, [budgetRupees, description, timeMinutes, title, urgency]);

  const lastLocationTs = useRef<number>(0);
  const voiceActiveRef = useRef(false);
  const voiceResultsRef = useRef<Set<string>>(new Set());
  const lastSpeechTimeRef = useRef<number>(0);
  const suggestionCache = useRef<Map<string, { at: number; data: LocationSuggestion[] }>>(new Map());
  const detailsCache = useRef<Map<string, { at: number; lat: number; lng: number; address?: string }>>(new Map());
  const geocodeCache = useRef<Map<string, { at: number; lat: number; lng: number; address?: string }>>(new Map());
  const placesSessionToken = useRef<string>('');

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

  const applySelectedLocation = useCallback(
    (latitude: number, longitude: number, nextAddress?: string) => {
      if (!isHyderabadLocation(latitude, longitude)) {
        setError(t('buyer.hyderabad_only'));
        return false;
      }
      setError(null);
      setLat(latitude);
      setLng(longitude);
      if (nextAddress && nextAddress.trim()) {
        setAddressText(nextAddress.trim());
      }
      return true;
    },
    [t],
  );

  const onMapPress = useCallback(
    (evt: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = evt.nativeEvent.coordinate;
      if (applySelectedLocation(latitude, longitude)) {
        resolveAddress(latitude, longitude);
      }
    },
    [applySelectedLocation, resolveAddress],
  );

  const refreshLocation = useCallback(async () => {
    setLocError(null);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (DEMO_FALLBACK_LOCATION) {
          setLat(DEMO_FALLBACK_LOCATION.lat);
          setLng(DEMO_FALLBACK_LOCATION.lng);
          setLocError(t('error.gps_unavailable'));
          return;
        }
        setLocError(t('error.location_unavailable'));
        return;
      }

      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        if (DEMO_FALLBACK_LOCATION) {
          setLat(DEMO_FALLBACK_LOCATION.lat);
          setLng(DEMO_FALLBACK_LOCATION.lng);
          setLocError(t('error.location_permission_fallback'));
          return;
        }
        setLocError(t('error.location_permission'));
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
        setLocError(t('error.location_fallback'));
        return;
      }
      setLocError(msg ? `${t('error.location_failed')}: ${msg}` : t('error.network'));
    }
  }, [t]);

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
    let isMounted = true;

    Voice.onSpeechResults = (event) => {
      if (!isMounted) return;
      const text = event.value?.[0] ?? '';
      if (text && text.trim()) {
        const timestamp = Date.now();
        // Prevent duplicate results within same speech session
        if (timestamp - lastSpeechTimeRef.current < 2000) {
          // Check if we've already processed this exact text
          if (voiceResultsRef.current.has(text)) {
            return;
          }
          voiceResultsRef.current.add(text);
        } else {
          // New speech session - clear previous results
          voiceResultsRef.current.clear();
          voiceResultsRef.current.add(text);
          lastSpeechTimeRef.current = timestamp;
        }
        // Only append if it's genuinely new content
        setDescription((prev) => {
          const trimmedText = text.trim();
          if (!trimmedText) return prev;
          // Check if the new text is already at the end to avoid duplicates
          if (prev && prev.trim().endsWith(trimmedText)) {
            return prev;
          }
          return prev ? `${prev.trim()} ${trimmedText}` : trimmedText;
        });
      }
    };

    Voice.onSpeechPartialResults = (event) => {
      // Don't append partial results to avoid duplicates - only use final results
      // This callback is useful for showing interim results but we skip appending
    };

    Voice.onSpeechError = () => {
      if (!isMounted) return;
      setVoiceError(t('error.voice_failed'));
      setVoiceActive(false);
      voiceActiveRef.current = false;
      voiceResultsRef.current.clear();
    };

    Voice.onSpeechEnd = () => {
      if (!isMounted) return;
      setVoiceActive(false);
      voiceActiveRef.current = false;
      voiceResultsRef.current.clear();
    };

    return () => {
      isMounted = false;
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, [t]);

  const searchLocation = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) return;
    const topSuggestion = suggestions[0];
    if (
      topSuggestion &&
      Number.isFinite(topSuggestion.lat) &&
      Number.isFinite(topSuggestion.lng)
    ) {
      const nextLat = Number(topSuggestion.lat);
      const nextLng = Number(topSuggestion.lng);
      if (applySelectedLocation(nextLat, nextLng, topSuggestion.description)) {
        setSuggestions([]);
      }
      return;
    }
    const effectiveQuery = topSuggestion?.description || query;
    const cacheKey = effectiveQuery.toLowerCase();
    const now = Date.now();
    const cached = geocodeCache.current.get(cacheKey);
    if (cached && now - cached.at < 5 * 60_000) {
      if (applySelectedLocation(cached.lat, cached.lng, cached.address)) {
        setSuggestions([]);
      }
      return;
    }
    setSearchBusy(true);
    setError(null);
    try {
      // OSM first: avoids unnecessary Google Geocoding spend.
      const osmUrl =
        'https://nominatim.openstreetmap.org/search' +
        `?format=jsonv2&limit=1&q=${encodeURIComponent(effectiveQuery)}` +
        '&viewbox=78.15,17.60,78.75,17.20&bounded=1';
      try {
        const osmRes = await fetch(osmUrl, {
          headers: {
            Accept: 'application/json',
          },
        });
        const osmJson = await osmRes.json();
        const first = Array.isArray(osmJson) ? osmJson[0] : null;
        const osmLat = first?.lat != null ? Number(first.lat) : NaN;
        const osmLng = first?.lon != null ? Number(first.lon) : NaN;
        if (Number.isFinite(osmLat) && Number.isFinite(osmLng)) {
          const addr =
            typeof first?.display_name === 'string' && first.display_name.trim()
              ? first.display_name.trim()
              : effectiveQuery;
          if (applySelectedLocation(osmLat, osmLng, addr)) {
            geocodeCache.current.set(cacheKey, { at: Date.now(), lat: osmLat, lng: osmLng, address: addr });
            setSuggestions([]);
          }
          return;
        }
      } catch {
        // fall through to Google fallback
      }

      if (!GOOGLE_MAPS_API_KEY) {
        setError(t('error.location_not_found'));
        return;
      }

      const url =
        'https://maps.googleapis.com/maps/api/geocode/json' +
        `?address=${encodeURIComponent(effectiveQuery)}` +
        '&components=country:IN' +
        `&location=${HYDERABAD.lat},${HYDERABAD.lng}&radius=55000` +
        `&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
      const res = await fetch(url);
      const json = await res.json();
      const candidate = json?.results?.[0];
      const loc = candidate?.geometry?.location;
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        const formattedAddress = candidate?.formatted_address as string | undefined;
        if (applySelectedLocation(loc.lat, loc.lng, formattedAddress)) {
          if (formattedAddress) {
            geocodeCache.current.set(cacheKey, { at: Date.now(), lat: loc.lat, lng: loc.lng, address: formattedAddress });
          } else {
            resolveAddress(loc.lat, loc.lng);
            geocodeCache.current.set(cacheKey, { at: Date.now(), lat: loc.lat, lng: loc.lng });
          }
          setSuggestions([]);
        }
      } else {
        setError(t('error.location_not_found'));
      }
    } catch {
      setError(t('error.network_check'));
    } finally {
      setSearchBusy(false);
    }
  }, [applySelectedLocation, resolveAddress, searchQuery, suggestions, t]);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      const key = query.toLowerCase();
      const now = Date.now();
      const cached = suggestionCache.current.get(key);
      if (cached && now - cached.at < 90_000) {
        setSuggestions(cached.data);
        return;
      }
      setAutoSearchBusy(true);
      try {
        // Free OSM autocomplete first.
        const osmUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=en&lat=${HYDERABAD.lat}&lon=${HYDERABAD.lng}`;
        try {
          const osmRes = await fetch(osmUrl, { headers: { Accept: 'application/json' } });
          const osmJson = await osmRes.json();
          const features = Array.isArray(osmJson?.features) ? osmJson.features : [];
          const osmSuggestions: LocationSuggestion[] = features
            .map((f: any, idx: number) => {
              const coords = Array.isArray(f?.geometry?.coordinates) ? f.geometry.coordinates : [];
              const lng = coords.length >= 2 ? Number(coords[0]) : NaN;
              const lat = coords.length >= 2 ? Number(coords[1]) : NaN;
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              const props = f?.properties || {};
              const labelParts = [
                props.name,
                props.street,
                props.city,
                props.state,
                props.country,
              ]
                .map((v: unknown) => (typeof v === 'string' ? v.trim() : ''))
                .filter(Boolean);
              const description = labelParts.length > 0 ? labelParts.join(', ') : query;
              return {
                placeId: `osm-${idx}-${lat.toFixed(5)}-${lng.toFixed(5)}`,
                description,
                source: 'osm',
                lat,
                lng,
              } as LocationSuggestion;
            })
            .filter(Boolean) as LocationSuggestion[];
          if (osmSuggestions.length > 0) {
            setSuggestions(osmSuggestions);
            suggestionCache.current.set(key, { at: now, data: osmSuggestions });
            return;
          }
        } catch {
          // continue to Google fallback
        }

        if (!GOOGLE_MAPS_API_KEY) {
          setSuggestions([]);
          return;
        }
        if (!placesSessionToken.current) {
          placesSessionToken.current = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        }

        const googleUrl =
          'https://maps.googleapis.com/maps/api/place/autocomplete/json' +
          `?input=${encodeURIComponent(query)}` +
          '&types=geocode' +
          '&components=country:in' +
          `&location=${HYDERABAD.lat},${HYDERABAD.lng}` +
          '&radius=55000' +
          `&sessiontoken=${encodeURIComponent(placesSessionToken.current)}` +
          `&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
        const res = await fetch(googleUrl);
        const json = await res.json();
        const preds = Array.isArray(json?.predictions) ? json.predictions : [];
        const trimmed: LocationSuggestion[] = preds.slice(0, 6).map((p: any) => ({
          placeId: p.place_id,
          description: p.description,
          source: 'google',
        }));
        setSuggestions(trimmed);
        suggestionCache.current.set(key, { at: now, data: trimmed });
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
      placesSessionToken.current = '';
      return undefined;
    }
    const t = setTimeout(() => {
      fetchSuggestions(q);
    }, 350);
    return () => clearTimeout(t);
  }, [fetchSuggestions, searchQuery]);

  const selectSuggestion = useCallback(
    async (suggestion: LocationSuggestion) => {
      setError(null);
      setSearchBusy(true);
      setSuggestions([]);
      setSearchQuery(suggestion.description);
      try {
        if (
          suggestion.source === 'osm' &&
          Number.isFinite(suggestion.lat) &&
          Number.isFinite(suggestion.lng)
        ) {
          const nextLat = Number(suggestion.lat);
          const nextLng = Number(suggestion.lng);
          setLat(nextLat);
          setLng(nextLng);
          setAddressText(suggestion.description);
          detailsCache.current.set(suggestion.placeId, {
            at: Date.now(),
            lat: nextLat,
            lng: nextLng,
            address: suggestion.description,
          });
          placesSessionToken.current = '';
          return;
        }

        if (!GOOGLE_MAPS_API_KEY) {
          setError(t('error.maps_api_key'));
          return;
        }

        const placeId = suggestion.placeId;
        const cached = detailsCache.current.get(placeId);
        if (cached && Date.now() - cached.at < 10 * 60_000) {
          if (applySelectedLocation(cached.lat, cached.lng, cached.address)) {
            if (!cached.address) {
              resolveAddress(cached.lat, cached.lng);
            }
          }
          placesSessionToken.current = '';
          return;
        }
        const url =
          'https://maps.googleapis.com/maps/api/place/details/json' +
          `?place_id=${encodeURIComponent(placeId)}` +
          '&fields=geometry,formatted_address,name' +
          `&sessiontoken=${encodeURIComponent(placesSessionToken.current || `${Date.now()}`)}` +
          `&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
        const res = await fetch(url);
        const json = await res.json();
        const result = json?.result;
        const loc = result?.geometry?.location;
        if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
          const selectedAddress =
            typeof result?.formatted_address === 'string'
              ? result.formatted_address
              : typeof result?.name === 'string'
                ? result.name
                : undefined;
          if (applySelectedLocation(loc.lat, loc.lng, selectedAddress)) {
            if (selectedAddress) {
              detailsCache.current.set(placeId, { at: Date.now(), lat: loc.lat, lng: loc.lng, address: selectedAddress });
            } else {
              resolveAddress(loc.lat, loc.lng);
              detailsCache.current.set(placeId, { at: Date.now(), lat: loc.lat, lng: loc.lng });
            }
          }
        }
      } catch {
        setError(t('error.fetch_details'));
      } finally {
        placesSessionToken.current = '';
        setSearchBusy(false);
      }
    },
    [applySelectedLocation, resolveAddress, t],
  );

  useEffect(() => {
    if (scheduleMode === 'now') {
      setScheduleAt(null);
      setScheduleTouched(false);
    }
  }, [scheduleMode]);

  const showDatePicker = useCallback(() => {
    if (Platform.OS !== 'android') return;
    const now = new Date();
    const fallback = new Date(now.getTime() + 10 * 60_000);
    const base = scheduleAt ?? fallback;
    const minimumDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    DateTimePickerAndroid.open({
      mode: 'date',
      value: base,
      minimumDate,
      onChange: (event, selectedDate) => {
        if (event.type !== 'set' || !selectedDate) return;
        setScheduleTouched(true);
        const merged = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          base.getHours(),
          base.getMinutes(),
          0,
          0,
        );
        setScheduleAt(merged);
      },
    });
  }, [scheduleAt]);

  const showTimePicker = useCallback(() => {
    if (Platform.OS !== 'android') return;
    const now = new Date();
    const fallback = new Date(now.getTime() + 10 * 60_000);
    const base = scheduleAt ?? fallback;
    DateTimePickerAndroid.open({
      mode: 'time',
      value: base,
      is24Hour: true,
      onChange: (event, selectedDate) => {
        if (event.type !== 'set' || !selectedDate) return;
        setScheduleTouched(true);
        const merged = new Date(
          base.getFullYear(),
          base.getMonth(),
          base.getDate(),
          selectedDate.getHours(),
          selectedDate.getMinutes(),
          0,
          0,
        );
        setScheduleAt(merged);
      },
    });
  }, [scheduleAt]);

  const onBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    (navigation as any).navigate('BuyerTabs', { screen: 'BuyerLanding' });
  }, [navigation]);

  const onCreate = useCallback(async () => {
    if (!canCreate || busy || lat == null || lng == null) return;
    setBusy(true);
    setError(null);
    try {
      if (!isHyderabadLocation(lat, lng)) {
        setError(t('buyer.hyderabad_only'));
        return;
      }
      if (scheduleMode === 'later' && !scheduleOk) {
        setError(t('schedule.invalid_datetime'));
        return;
      }
      const scheduledAtIso = scheduleMode === 'later' && scheduledAt ? scheduledAt.toISOString() : null;
      const helpersNeeded = Math.max(1, Math.min(25, Number(helperCount) || 1));
      if (helpersNeeded > 1) {
        const res = await withAuth((t) =>
          api.createBulkTask(t, {
            title: title.trim(),
            description: description.trim(),
            urgency,
            timeMinutes: Number(timeMinutes),
            budgetPaise: Math.round(Number(budgetRupees) * 100),
            lat,
            lng,
            addressText: addressText.trim() || null,
            scheduledAt: scheduledAtIso,
            helperCount: helpersNeeded,
          }),
        );
        if (res.batchId) {
          await setActiveTaskId(null);
          navigation.navigate('BuyerBulkRequest', { batchId: res.batchId });
          return;
        }
        const firstTaskId = Array.isArray(res.taskIds) ? res.taskIds[0] : null;
        if (firstTaskId) {
          await setActiveTaskId(firstTaskId);
          navigation.navigate('BuyerTask', { taskId: firstTaskId });
          return;
        }
      } else {
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
            scheduledAt: scheduledAtIso,
          }),
        );
        await setActiveTaskId(res.taskId);
        navigation.navigate('BuyerTask', { taskId: res.taskId });
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      if (e instanceof ApiError) {
        setError(e.message || t('error.create_task'));
      } else {
        setError(t('error.create_task'));
      }
    } finally {
      setBusy(false);
    }
  }, [addressText, budgetRupees, busy, canCreate, description, helperCount, lat, lng, navigation, scheduleMode, scheduleOk, scheduledAt, setActiveTaskId, timeMinutes, title, urgency, withAuth, t]);

  const toggleVoice = useCallback(async () => {
    setVoiceError(null);
    if (voiceActiveRef.current) {
      await Voice.stop();
      setVoiceActive(false);
      voiceActiveRef.current = false;
      voiceResultsRef.current.clear();
      return;
    }
    try {
      // Clear previous results before starting new recording
      voiceResultsRef.current.clear();
      lastSpeechTimeRef.current = Date.now();
      await Voice.start('en-IN');
      setVoiceActive(true);
      voiceActiveRef.current = true;
    } catch {
      setVoiceError(t('error.voice_unavailable'));
      setVoiceActive(false);
      voiceActiveRef.current = false;
    }
  }, [t]);

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.kav}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: theme.space.xl * 2.6 + Math.max(insets.bottom, theme.space.lg) + tabBarHeight },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <View style={styles.topLeft}>
              <Pressable accessibilityRole="button" onPress={onBack} style={styles.backBtn}>
                <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text} />
              </Pressable>
            </View>
            <Text style={styles.h1}>{t('buyer.create_task')}</Text>
            <View style={styles.topLinks}>
              <Pressable onPress={() => navigation.navigate('SupportTickets')} style={styles.linkPill}>
                <MaterialCommunityIcons name="lifebuoy" size={14} color={theme.colors.primary} />
                <Text style={styles.linkPillText}>{t('buyer.support')}</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate('Profile')} style={styles.linkPill}>
                <MaterialCommunityIcons name="account-circle-outline" size={14} color={theme.colors.primary} />
                <Text style={styles.linkPillText}>{t('menu.profile')}</Text>
              </Pressable>
            </View>
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
            <PrimaryButton
              label={t('buyer.search')}
              onPress={searchLocation}
              loading={searchBusy}
              style={styles.searchBtn}
              leftIcon={<MaterialCommunityIcons name="magnify" size={18} color={theme.colors.primaryText} />}
            />
          </View>
          {autoSearchBusy ? <Text style={styles.muted}>{t('buyer.searching_suggestions')}</Text> : null}
          {suggestions.length > 0 ? (
            <View style={styles.suggestions}>
              {suggestions.map((s) => (
                <Pressable key={s.placeId} style={styles.suggestionRow} onPress={() => selectSuggestion(s)}>
                  <Text style={styles.suggestionText}>{s.description}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {addressText ? (
            <View style={styles.addressBox}>
              <Text style={styles.addressLabel}>{t('buyer.selected_address')}</Text>
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
                    latitude: lat ?? DEMO_FALLBACK_LOCATION?.lat ?? HYDERABAD.lat,
                    longitude: lng ?? DEMO_FALLBACK_LOCATION?.lng ?? HYDERABAD.lng,
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
                    <Marker coordinate={{ latitude: lat, longitude: lng }} title={t('buyer.pickup_location')} />
                  ) : null}
                </MapView>
              </View>
            ) : (
              <Notice kind="warning" text={t('error.maps_api_key')} />
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
                leftIcon={
                  <MaterialCommunityIcons
                    name={voiceActive ? 'microphone-off' : 'microphone'}
                    size={18}
                    color={theme.colors.primary}
                  />
                }
              />
            </View>
            <TextField label={t('buyer.expected_time')} value={timeMinutes} onChangeText={setTimeMinutes} keyboardType="number-pad" />
            <TextField label={t('buyer.budget')} value={budgetRupees} onChangeText={setBudgetRupees} keyboardType="number-pad" />
            <TextField
              label={t('buyer.helpers_needed')}
              value={helperCount}
              onChangeText={setHelperCount}
              keyboardType="number-pad"
            />
            {pricing ? (
              <View style={styles.smartPriceBox}>
                <Text style={styles.smartPriceTitle}>{t('buyer.smart_price_title')}</Text>
                <Text style={styles.smartPriceText}>
                  {t('buyer.smart_price_suggested').replace('{amount}', String(pricing.suggested))}
                </Text>
                <Text
                  style={[
                    styles.smartPriceVerdict,
                    pricing.verdict === 'low'
                      ? styles.smartPriceLow
                      : pricing.verdict === 'high'
                        ? styles.smartPriceHigh
                        : styles.smartPriceFair,
                  ]}
                >
                  {pricing.verdict === 'low'
                    ? t('buyer.smart_price_low')
                    : pricing.verdict === 'high'
                      ? t('buyer.smart_price_high')
                      : t('buyer.smart_price_fair')}
                </Text>
              </View>
            ) : null}
            <Text style={styles.section}>{t('schedule.title')}</Text>
            <Segmented options={scheduleOptions} value={scheduleMode} onChange={(v) => setScheduleMode(v as 'now' | 'later')} />
            {scheduleMode === 'later' ? (
              <View style={styles.scheduleWrap}>
                <View style={styles.scheduleRow}>
                  <Pressable style={styles.scheduleFieldBtn} onPress={showDatePicker}>
                    <Text style={styles.scheduleFieldLabel}>{t('schedule.date_label')}</Text>
                    <View style={styles.scheduleFieldValueWrap}>
                      <MaterialCommunityIcons name="calendar-month-outline" size={18} color={theme.colors.muted} />
                      <Text style={scheduledAt ? styles.scheduleFieldValue : styles.scheduleFieldPlaceholder}>
                        {scheduledAt ? toYmd(scheduledAt) : t('schedule.date_placeholder')}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable style={styles.scheduleFieldBtn} onPress={showTimePicker}>
                    <Text style={styles.scheduleFieldLabel}>{t('schedule.time_label')}</Text>
                    <View style={styles.scheduleFieldValueWrap}>
                      <MaterialCommunityIcons name="clock-outline" size={18} color={theme.colors.muted} />
                      <Text style={scheduledAt ? styles.scheduleFieldValue : styles.scheduleFieldPlaceholder}>
                        {scheduledAt ? toHm(scheduledAt) : t('schedule.time_placeholder')}
                      </Text>
                    </View>
                  </Pressable>
                </View>
                <Text style={styles.muted}>{t('schedule.help')}</Text>
                {!scheduleOk && scheduleTouched ? (
                  <Text style={styles.scheduleError}>{t('schedule.invalid_datetime')}</Text>
                ) : null}
              </View>
            ) : null}
            <Segmented options={urgencyOptions} value={urgency} onChange={(v) => setUrgency(v as TaskUrgency)} />
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 10,
    ...theme.shadow.card,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: theme.space.xs },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  topLinks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h1: { color: theme.colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
  muted: { color: theme.colors.muted, fontSize: 12.5 },
  linkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.card,
  },
  linkPillText: { color: theme.colors.primary, fontWeight: '800', fontSize: 12 },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radius.lg,
    padding: theme.space.md + 2,
    gap: theme.space.sm,
    ...theme.shadow.lifted,
  },
  voiceRow: { gap: theme.space.xs },
  voiceBtn: { alignSelf: 'flex-start' },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.space.sm },
  searchField: { flex: 1 },
  searchBtn: { alignSelf: 'flex-end' },
  mapWrap: { height: 220, borderRadius: theme.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border },
  map: { flex: 1 },
  section: { color: theme.colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.25 },
  suggestions: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
    ...theme.shadow.card,
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
    backgroundColor: theme.colors.inputBg,
    gap: 6,
  },
  addressLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '800' },
  addressValue: { color: theme.colors.text, fontSize: 13, lineHeight: 18 },
  smartPriceBox: {
    borderWidth: 1,
    borderColor: theme.colors.glow,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceRaised,
    padding: theme.space.sm,
    gap: 4,
    ...theme.shadow.card,
  },
  smartPriceTitle: { color: theme.colors.text, fontSize: 12, fontWeight: '800' },
  smartPriceText: { color: theme.colors.muted, fontSize: 12 },
  smartPriceVerdict: { fontSize: 12, fontWeight: '700' },
  smartPriceLow: { color: theme.colors.warning },
  smartPriceFair: { color: theme.colors.success },
  smartPriceHigh: { color: theme.colors.primary },
  scheduleWrap: { gap: theme.space.xs },
  scheduleRow: { flexDirection: 'row', gap: theme.space.sm },
  scheduleFieldBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 10,
    gap: 6,
  },
  scheduleFieldLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '800' },
  scheduleFieldValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 20 },
  scheduleFieldValue: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  scheduleFieldPlaceholder: { color: theme.colors.muted, fontSize: 14 },
  scheduleError: { color: theme.colors.danger, fontSize: 12 },
  actionsRow: { flexDirection: 'row', gap: theme.space.sm, marginTop: 8 },
  half: { flex: 1 },
});
