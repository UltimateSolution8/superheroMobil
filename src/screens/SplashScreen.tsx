import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AuthStackParamList } from '../navigation/types';
import { theme } from '../ui/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ribbon = useRef(new Animated.Value(0)).current;
  const confetti = useMemo(
    () =>
      Array.from({ length: 18 }, (_, idx) => ({
        id: idx,
        x: (width / 18) * idx + 4,
        delay: idx * 110,
        drift: idx % 2 === 0 ? -14 : 14,
        y: new Animated.Value(-40 - idx * 18),
      })),
    [width],
  );
  const fireworks = useMemo(
    () =>
      Array.from({ length: 6 }, (_, idx) => ({
        id: idx,
        x: 40 + (width - 80) * (idx / 5),
        y: 120 + (idx % 3) * 120,
        scale: new Animated.Value(0),
        opacity: new Animated.Value(0),
        delay: idx * 180,
      })),
    [width],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(ribbon, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ),
    ]).start();

    confetti.forEach((piece) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(piece.delay),
          Animated.timing(piece.y, {
            toValue: height + 40,
            duration: 2600,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(piece.y, {
            toValue: -60,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });

    fireworks.forEach((burst) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(burst.delay),
          Animated.parallel([
            Animated.timing(burst.scale, {
              toValue: 1,
              duration: 900,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(burst.opacity, {
              toValue: 0.9,
              duration: 240,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(burst.opacity, {
            toValue: 0,
            duration: 500,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(burst.scale, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });

    const t = setTimeout(() => {
      navigation.replace('Onboarding');
    }, 3000);
    return () => clearTimeout(t);
  }, [confetti, fireworks, height, navigation, opacity, ribbon, scale]);

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.confettiLayer} pointerEvents="none">
        {confetti.map((piece) => (
          <Animated.View
            key={piece.id}
            style={[
              styles.confetti,
              {
                left: piece.x,
                transform: [
                  { translateY: piece.y },
                  {
                    rotate: ribbon.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '12deg'],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
        {fireworks.map((burst) => (
          <Animated.View
            key={`fw-${burst.id}`}
            style={[
              styles.firework,
              {
                left: burst.x,
                top: burst.y,
                opacity: burst.opacity,
                transform: [{ scale: burst.scale }],
              },
            ]}
          />
        ))}
        <Animated.View
          style={[
            styles.ribbon,
            {
              top: 40,
              left: 24,
              transform: [
                {
                  rotate: ribbon.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['-8deg', '8deg'],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.ribbon,
            styles.ribbonAlt,
            {
              top: 90,
              right: 30,
              transform: [
                {
                  rotate: ribbon.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['10deg', '-6deg'],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ scale }], opacity }}>
          <Image source={require('../../assets/superheroo-logo.png')} style={styles.logo} />
        </Animated.View>
        <Animated.Text style={[styles.title, { opacity }]}>Superheroo</Animated.Text>
        <Animated.Text style={[styles.tagline, { opacity }]}>Help in minutes</Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: { width: 180, height: 180, borderRadius: 48 },
  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  tagline: { color: '#E2E8F0', fontWeight: '700' },
  confettiLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  confetti: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 6,
    backgroundColor: theme.colors.accent,
    opacity: 0.85,
  },
  firework: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: '#FDE68A',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  ribbon: {
    position: 'absolute',
    width: 140,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#93C5FD',
    opacity: 0.7,
  },
  ribbonAlt: {
    width: 120,
    height: 6,
    backgroundColor: '#FDE68A',
  },
});
