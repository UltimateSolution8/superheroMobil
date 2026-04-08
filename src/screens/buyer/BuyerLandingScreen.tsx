import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../../auth/AuthContext';
import { Screen } from '../../ui/Screen';
import { theme } from '../../ui/theme';
import { useI18n } from '../../i18n/I18nProvider';

type Availability = 'checking' | 'live' | 'coming' | 'unknown';

const HYDERABAD = { lat: 17.385, lng: 78.4867 };
const LIVE_RADIUS_KM = 55;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 6371 * (2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)));
}

export function BuyerLandingScreen() {
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const { t } = useI18n();
  const showBulk = Boolean(user?.bulkCsvEnabled);
  const [availability, setAvailability] = useState<Availability>('checking');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          if (active) setAvailability('unknown');
          return;
        }
        const last = await Location.getLastKnownPositionAsync({ maxAge: 20 * 60_000, requiredAccuracy: 2_500 });
        const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        const km = haversineKm(pos.coords.latitude, pos.coords.longitude, HYDERABAD.lat, HYDERABAD.lng);
        if (active) {
          setAvailability(km <= LIVE_RADIUS_KM ? 'live' : 'coming');
        }
      } catch {
        if (active) setAvailability('unknown');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const locationText = useMemo(() => {
    if (availability === 'live') return t('home.city_live').replace('{city}', 'Hyderabad');
    if (availability === 'coming') return t('home.not_available');
    if (availability === 'checking') return t('home.checking_area');
    return t('home.live_city_line').replace('{city}', 'Hyderabad');
  }, [availability, t]);

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroHead}>
            <Image source={require('../../../assets/superheroo-logo.png')} style={styles.logo} />
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroKicker}>{t('home.trusted_line')}</Text>
              <Text style={styles.heroTitle}>
                {t('home.welcome')}, {user?.displayName?.trim() || t('role.citizen')}
              </Text>
            </View>
          </View>
          <Text style={styles.heroSub}>{locationText}</Text>
          <View style={styles.cityChips}>
            <View style={styles.cityChipLive}>
              <Text style={styles.cityChipLiveText}>Hyderabad • {t('home.live_now')}</Text>
            </View>
            <View style={styles.cityChip}>
              <Text style={styles.cityChipText}>{t('home.launching_soon_line')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <Pressable style={styles.quickCard} onPress={() => nav.navigate('BuyerHome')}>
            <MaterialCommunityIcons name="plus-circle-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.quickTitle}>{t('tabs.create_task')}</Text>
            <Text style={styles.quickSub}>{t('home.quick_create')}</Text>
          </Pressable>
          {showBulk ? (
            <Pressable style={styles.quickCard} onPress={() => nav.navigate('BuyerBulkTasks')}>
              <MaterialCommunityIcons name="file-delimited-outline" size={24} color={theme.colors.primary} />
              <Text style={styles.quickTitle}>{t('tabs.bulk')}</Text>
              <Text style={styles.quickSub}>{t('home.quick_bulk')}</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.quickCard} onPress={() => nav.navigate('History')}>
            <MaterialCommunityIcons name="history" size={24} color={theme.colors.primary} />
            <Text style={styles.quickTitle}>{t('tabs.tasks')}</Text>
            <Text style={styles.quickSub}>{t('home.quick_tasks')}</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={() => nav.navigate('SupportTickets')}>
            <MaterialCommunityIcons name="lifebuoy" size={24} color={theme.colors.primary} />
            <Text style={styles.quickTitle}>{t('buyer.support')}</Text>
            <Text style={styles.quickSub}>{t('home.quick_support')}</Text>
          </Pressable>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>{t('home.why_title')}</Text>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="clock-fast" size={18} color={theme.colors.primary} />
            <Text style={styles.featureText}>{t('home.feature_fast')}</Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.featureText}>{t('home.feature_tracking')}</Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="shield-check-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.featureText}>{t('home.feature_verified')}</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0 },
  scroll: { padding: theme.space.lg, gap: theme.space.md, paddingBottom: theme.space.xl * 2 },
  hero: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.card,
    padding: theme.space.md,
    gap: 10,
    ...theme.shadow.lifted,
  },
  heroHead: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  logo: { width: 58, height: 58, borderRadius: 16 },
  heroTextWrap: { flex: 1, gap: 4 },
  heroKicker: { color: theme.colors.primary, fontWeight: '900', fontSize: 12, letterSpacing: 0.2 },
  heroTitle: { color: theme.colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  heroSub: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },
  cityChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  cityChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surfaceSoft,
  },
  cityChipLive: {
    borderWidth: 1,
    borderColor: theme.colors.success,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surfaceSoft,
  },
  cityChipText: { color: theme.colors.muted, fontSize: 11.5, fontWeight: '700' },
  cityChipLiveText: { color: theme.colors.success, fontSize: 11.5, fontWeight: '800' },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  quickCard: {
    width: '48.2%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    padding: theme.space.md,
    gap: 6,
    ...theme.shadow.card,
  },
  quickTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '900' },
  quickSub: { color: theme.colors.muted, fontSize: 11.5, lineHeight: 16 },
  featureCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    padding: theme.space.md,
    gap: 10,
    ...theme.shadow.card,
  },
  featureTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '900' },
  featureRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  featureText: { color: theme.colors.muted, fontSize: 12.5, lineHeight: 18, flex: 1 },
});
