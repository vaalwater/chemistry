import { Platform } from 'react-native';

export const colors = {
  bg: '#F1F6FD',
  card: '#FFFFFF',
  ink: '#16324f',
  inkSoft: '#43597a',
  sub: '#67809f',
  faint: '#9db0c8',
  line: '#E3EBF5',
  accent: '#2f6fed',
  accentSoft: '#E8F0FE',
  green: '#1fa97a',
  orange: '#e2822f',
  red: '#e5524a',
  purple: '#8a63d2',
  cyan: '#2fa7e8',
  tabBar: 'rgba(255,255,255,0.92)',
};

export const font = {
  regular: Platform.select({ ios: undefined, default: undefined }),
};

export const radii = {
  card: 18,
  chip: 999,
};

export const shadow = {
  card: {
    shadowColor: '#1d3a63',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
};
