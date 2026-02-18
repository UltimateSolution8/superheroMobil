import React, { useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AuthStackParamList } from '../navigation/types';
import { PrimaryButton } from '../ui/PrimaryButton';
import { theme } from '../ui/theme';
import { Segmented } from '../ui/Segmented';
import { useI18n } from '../i18n/I18nProvider';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

const PAGES = [
  {
    title: 'Post Small Tasks',
    subtitle: 'Get help in minutes for errands, loading, or quick fixes.',
    badge: '01',
  },
  {
    title: 'Track Your Hero Live',
    subtitle: 'See the helper move in real time with ETA updates.',
    badge: '02',
  },
  {
    title: 'Secure Escrow Payment',
    subtitle: 'Pay safely and release only after completion.',
    badge: '03',
  },
];

export function OnboardingScreen({ navigation }: Props) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pageWidth = width;
  const cardWidth = Math.min(width - 48, 360);
  const { lang, setLang } = useI18n();

  const ctaLabel = useMemo(() => (page === PAGES.length - 1 ? 'Get Started' : 'Next'), [page]);

  const onNext = () => {
    if (page < PAGES.length - 1) {
      const next = page + 1;
      setPage(next);
      scrollRef.current?.scrollTo({ x: next * pageWidth, animated: true });
    } else {
      navigation.replace('Login');
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        <Segmented
          value={lang}
          onChange={(v) => setLang(v as 'en' | 'hi' | 'te')}
          options={[
            { key: 'en', label: 'EN' },
            { key: 'hi', label: 'हिं' },
            { key: 'te', label: 'తెల' },
          ]}
        />
        <View style={styles.brandRow}>
          <Image source={require('../assets/superheroo-logo.png')} style={styles.logo} />
          <View>
            <Text style={styles.brand}>Superheroo</Text>
            <Text style={styles.tagline}>Tap. Create. Relax.</Text>
          </View>
        </View>
        <Text style={styles.skip} onPress={() => navigation.replace('Login')}>
          Skip
        </Text>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        ref={scrollRef}
        snapToInterval={pageWidth}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
          setPage(Math.min(Math.max(next, 0), PAGES.length - 1));
        }}
      >
        {PAGES.map((item) => (
          <View key={item.title} style={[styles.page, { width: pageWidth }]}>
            <View style={[styles.card, { width: cardWidth }]}>
              <Image source={require('../assets/superheroo-logo.png')} style={styles.pageLogo} />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {PAGES.map((_, idx) => (
          <View key={idx} style={[styles.dot, idx === page ? styles.dotActive : null]} />
        ))}
      </View>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
        <PrimaryButton label={ctaLabel} onPress={onNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg, paddingTop: 16 },
  header: { paddingHorizontal: 20, gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between' },
  logo: { width: 44, height: 44, borderRadius: 14 },
  brand: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  tagline: { color: theme.colors.muted, fontSize: 12 },
  skip: { color: theme.colors.primary, fontWeight: '700' },
  page: {
    marginTop: 70,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  card: {
    marginHorizontal: 24,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
    gap: 10,
    ...theme.shadow.card,
  },
  pageLogo: { width: 72, height: 72, borderRadius: 18, alignSelf: 'center' },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 16, fontWeight: '800', color: theme.colors.primary },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  subtitle: { color: theme.colors.muted, lineHeight: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.border },
  dotActive: { width: 22, backgroundColor: theme.colors.primary },
  cta: { paddingHorizontal: 24, paddingVertical: 24 },
});
