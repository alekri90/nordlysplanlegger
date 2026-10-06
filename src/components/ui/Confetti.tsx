import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const COLORS = ['#FF5F6D', '#FF9A8B', '#FFC371', '#7EE2B0', '#8AB4FF', '#FF6B9A'];

type Piece = { x: number; delay: number; size: number; color: string; drift: number; spin: number; round: boolean };

function ConfettiPiece({ piece, height }: { piece: Piece; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(piece.delay, withTiming(1, { duration: 1900, easing: Easing.out(Easing.quad) }));
  }, [piece.delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.85 ? 1 : (1 - t.value) / 0.15,
    transform: [
      { translateY: -40 + t.value * height * 0.75 },
      { translateX: piece.drift * Math.sin(t.value * Math.PI * 2) },
      { rotate: `${piece.spin * t.value}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: piece.x,
          top: 0,
          width: piece.size,
          height: piece.round ? piece.size : piece.size * 0.45,
          borderRadius: piece.round ? piece.size / 2 : 2,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

/** Deterministic pseudo-random in [0, 1) so rendering stays pure. */
function rand(i: number, k: number) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** A small, tasteful burst — used when a date is locked or everyone can make it. */
export function Confetti({ count = 36, active = true }: { count?: number; active?: boolean }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        x: rand(i, 1) * width,
        delay: rand(i, 2) * 350,
        size: 6 + rand(i, 3) * 6,
        color: COLORS[i % COLORS.length],
        drift: 10 + rand(i, 4) * 24,
        spin: (rand(i, 5) > 0.5 ? 1 : -1) * (180 + rand(i, 6) * 360),
        round: i % 3 === 0,
      })),
    [count, width],
  );
  if (!active || reduceMotion) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} piece={p} height={height} />
      ))}
    </View>
  );
}
