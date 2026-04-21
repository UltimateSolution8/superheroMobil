import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

export function HelperLandingScreen() {
  const nav = useNavigation<any>();
  const { user, withAuth } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
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

  return (
    <Screen style={styles.screen}>
      <View pointerEvents="none" style={styles.bgLayer}>
        <View style={styles.bgTopShade} />
        <View style={styles.bgBottomShade} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: tabBarHeight + Math.max(insets.bottom, theme.space.md) + theme.space.xl * 0.9 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroHead}>
            <Image source={require('../../../assets/superheroo-logo.png')} style={styles.logo} />
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroTitle}>
                {t('home.welcome')}, {user?.displayName?.trim() || t('role.superherooo')}
              </Text>
            </View>
          </View>
          <Text style={styles.heroSub}>{t('home.trusted_line')}</Text>
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

        <Text style={styles.loveText}>{t('home.most_loved')}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0, backgroundColor: '#DEFAF3' },
  bgLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  bgTopShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: 'rgba(15,118,110,0.18)',
  },
  bgBottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
    backgroundColor: 'rgba(15,118,110,0.15)',
  },
  scroll: { padding: theme.space.lg, gap: theme.space.md, paddingBottom: theme.space.xl * 1.2 },
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
  heroTitle: { color: theme.colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  heroSub: { color: theme.colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
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
  loveText: {
    marginTop: theme.space.sm,
    marginBottom: 0,
    color: theme.colors.primary,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
});
