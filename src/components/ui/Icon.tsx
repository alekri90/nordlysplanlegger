import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

import { useColors, type ColorTokens } from '@/theme';

export type IconName = ComponentProps<typeof Feather>['name'];

type Props = {
  name: IconName;
  size?: number;
  color?: keyof ColorTokens;
  /** Raw colour, overrides `color`. */
  tint?: string;
};

/** Single icon family (Feather) keeps the visual language calm and consistent. */
export function Icon({ name, size = 20, color = 'text', tint }: Props) {
  const colors = useColors();
  // Icons are decorative; the surrounding control carries the label. (On web the prop would leak into the DOM.)
  return <Feather name={name} size={size} color={tint ?? colors[color]} {...(Platform.OS === 'web' ? {} : { accessible: false })} />;
}
