import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HelperProfile } from '../../api/types';
import * as api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Notice } from '../../ui/Notice';
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

export function HelperLandingScreen() {
  const nav = useNavigation<any>();
  const { user, withAuth } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [availability, setAvailability] = useState<Availability>('checking');
  const [profile, setProfile] = useState<HelperProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setError(null);
    try {
      const res = await withAuth((at) => api.helperGetProfile(at));
      setProfile(res);
    } catch {
      setError(t('profile.load_error'));
    }
  }, [t, withAuth]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
        if (active) setAvailability(km <= LIVE_RADIUS_KM ? 'live' : 'coming');
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
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + Math.max(insets.bottom, theme.space.md) + theme.space.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroHead}>
            <Image source={require('../../../assets/superheroo-logo.png')} style={styles.logo} />
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroKicker}>{t('home.trusted_line')}</Text>
              <Text style={styles.heroTitle}>
                {t('home.welcome')}, {user?.displayName?.trim() || t('role.superherooo')}
              </Text>
            </View>
          </View>
          <Text style={styles.heroSub}>{locationText}</Text>
          <View style={styles.kycBadge}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.kycBadgeText}>
              {t('helper.kyc.status')}: {profile?.kycStatus || 'PENDING'}
            </Text>
          </View>
          {profile?.kycStatus === 'PENDING' ? <Notice kind="warning" text={t('helper.kyc.pending')} /> : null}
          {profile?.kycStatus === 'REJECTED' ? (
            <Notice
              kind="danger"
              text={`${t('helper.kyc.rejected')}${profile.kycRejectionReason ? `: ${profile.kycRejectionReason}` : ''}`}
            />
          ) : null}
        </View>

        {error ? <Notice kind="danger" text={error} /> : null}

        <View style={styles.photoRow}>
          <ImageBackground source={require('../../../assets/landing/partner-team.jpg')} style={styles.photoCard} imageStyle={styles.photoImage}>
            <View style={styles.photoOverlay}>
              <Text style={styles.photoKicker}>{t('home.card_partner_kicker')}</Text>
              <Text style={styles.photoTitle}>{t('home.card_partner_title')}</Text>
              <Text style={styles.photoSub}>{t('home.card_partner_sub')}</Text>
            </View>
          </ImageBackground>
          <ImageBackground source={require('../../../assets/landing/hyderabad-city.jpg')} style={styles.photoCard} imageStyle={styles.photoImage}>
            <View style={styles.photoOverlay}>
              <Text style={styles.photoKicker}>{t('home.card_city_kicker')}</Text>
              <Text style={styles.photoTitle}>{t('home.card_city_title')}</Text>
              <Text style={styles.photoSub}>{t('home.card_city_sub')}</Text>
            </View>
          </ImageBackground>
        </View>

        <View style={styles.quickGrid}>
          <Pressable style={styles.quickCard} onPress={() => nav.navigate('HelperHome')}>
            <MaterialCommunityIcons name="briefcase-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.quickTitle}>{t('tabs.tasks')}</Text>
            <Text style={styles.quickSub}>{t('home.quick_task_feed')}</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={() => nav.navigate('HelperLearn')}>
            <MaterialCommunityIcons name="school-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.quickTitle}>{t('tabs.learn')}</Text>
            <Text style={styles.quickSub}>{t('home.quick_learn')}</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={() => nav.navigate('HelperIdCard')}>
            <MaterialCommunityIcons name="card-account-details-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.quickTitle}>{t('menu.id_card')}</Text>
            <Text style={styles.quickSub}>{t('home.quick_id')}</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={() => nav.navigate('SupportTickets')}>
            <MaterialCommunityIcons name="lifebuoy" size={24} color={theme.colors.primary} />
            <Text style={styles.quickTitle}>{t('buyer.support')}</Text>
            <Text style={styles.quickSub}>{t('home.quick_support')}</Text>
          </Pressable>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>{t('home.partner_title')}</Text>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="clock-fast" size={18} color={theme.colors.primary} />
            <Text style={styles.featureText}>{t('home.partner_feature_earn')}</Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="account-check-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.featureText}>{t('home.partner_feature_verify')}</Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="map-marker-path" size={18} color={theme.colors.primary} />
            <Text style={styles.featureText}>{t('home.partner_feature_nearby')}</Text>
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
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: theme.colors.surfaceSoft,
  },
  kycBadgeText: { color: theme.colors.text, fontSize: 12, fontWeight: '700' },
  photoRow: { gap: theme.space.sm },
  photoCard: {
    minHeight: 138,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  photoImage: { borderRadius: theme.radius.lg },
  photoOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: 4,
    padding: theme.space.md,
    backgroundColor: 'rgba(4, 10, 24, 0.44)',
  },
  photoKicker: { color: '#E6F1FF', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  photoTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  photoSub: { color: '#E6EAF2', fontSize: 12, lineHeight: 17 },
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
