import { TextStyle } from 'react-native';

export const fontSize = {
  hero: 28,
  h1: 22,
  h2: 18,
  body: 16,
  caption: 13,
  price: 24,
  priceSm: 18,
} as const;

export const fontWeight = {
  regular: '400' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
  extrabold: '800' as TextStyle['fontWeight'],
};
