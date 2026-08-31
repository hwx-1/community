import {useColorScheme} from 'react-native';

export type AppTheme = {
  dark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceMuted: string;
    primary: string;
    primarySoft: string;
    text: string;
    textSecondary: string;
    border: string;
    danger: string;
    success: string;
    scrim: string;
  };
};

const light: AppTheme = {
  dark: false,
  colors: {
    background: '#F6F7F9',
    surface: '#FFFFFF',
    surfaceMuted: '#F2F3F5',
    primary: '#E9163F',
    primarySoft: '#FFF0F3',
    text: '#17181A',
    textSecondary: '#60646C',
    border: '#E4E6EA',
    danger: '#C71833',
    success: '#147A4A',
    scrim: 'rgba(0,0,0,0.52)',
  },
};

const dark: AppTheme = {
  dark: true,
  colors: {
    background: '#0F1012',
    surface: '#181A1E',
    surfaceMuted: '#23262B',
    primary: '#FF4966',
    primarySoft: '#381820',
    text: '#F7F8FA',
    textSecondary: '#B5BAC3',
    border: '#30343A',
    danger: '#FF7187',
    success: '#55C58A',
    scrim: 'rgba(0,0,0,0.68)',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export function useAppTheme(): AppTheme {
  return useColorScheme() === 'dark' ? dark : light;
}

