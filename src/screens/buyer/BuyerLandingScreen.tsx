import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthContext';
import { Screen } from '../../ui/Screen';
import { theme } from '../../ui/theme';
import { useI18n } from '../../i18n/I18nProvider';

export function BuyerLandingScreen() {
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const showBulk = Boolean(user?.bulkCsvEnabled);

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: tabBarHeight + Math.max(insets.bottom, theme.space.md) + theme.space.xl * 1.6 },
        ]}
        showsVerticalScrollIndicator={false}
      >
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
          <Text style={styles.heroSub}>{t('home.trusted_line')}</Text>
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

        <Text style={styles.loveText}>{t('home.most_loved')}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0, backgroundColor: '#EAF2FF' },
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
  heroSub: { color: theme.colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
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
    marginBottom: theme.space.md,
    color: theme.colors.primary,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
});
