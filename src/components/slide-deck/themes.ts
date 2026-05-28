import type { MagazineTheme, SwissTheme, ThemeColors, DeckStyle } from './types'

export const magazineThemes: Record<MagazineTheme, ThemeColors> = {
  'ink-classic': {
    ink: '#0a0a0b',
    'ink-rgb': '10,10,11',
    paper: '#f1efea',
    'paper-rgb': '241,239,234',
    'paper-tint': '#e8e5de',
    'ink-tint': '#18181a',
    accent: '#0a0a0b',
    'accent-rgb': '10,10,11',
  },
  'indigo-porcelain': {
    ink: '#0a1f3d',
    'ink-rgb': '10,31,61',
    paper: '#f1f3f5',
    'paper-rgb': '241,243,245',
    'paper-tint': '#e4e8ec',
    'ink-tint': '#152a4a',
    accent: '#0a1f3d',
    'accent-rgb': '10,31,61',
  },
  'forest-ink': {
    ink: '#1a2e1f',
    'ink-rgb': '26,46,31',
    paper: '#f5f1e8',
    'paper-rgb': '245,241,232',
    'paper-tint': '#ece7da',
    'ink-tint': '#253d2c',
    accent: '#1a2e1f',
    'accent-rgb': '26,46,31',
  },
  'kraft-paper': {
    ink: '#2a1e13',
    'ink-rgb': '42,30,19',
    paper: '#eedfc7',
    'paper-rgb': '238,223,199',
    'paper-tint': '#e0d0b6',
    'ink-tint': '#3a2a1d',
    accent: '#2a1e13',
    'accent-rgb': '42,30,19',
  },
  dune: {
    ink: '#1f1a14',
    'ink-rgb': '31,26,20',
    paper: '#f0e6d2',
    'paper-rgb': '240,230,210',
    'paper-tint': '#e3d7bf',
    'ink-tint': '#2d2620',
    accent: '#1f1a14',
    'accent-rgb': '31,26,20',
  },
}

export const swissThemes: Record<SwissTheme, ThemeColors> = {
  ikb: {
    ink: '#0a0a0b',
    'ink-rgb': '10,10,11',
    paper: '#f5f5f5',
    'paper-rgb': '245,245,245',
    'paper-tint': '#e8e8e8',
    'ink-tint': '#1a1a1d',
    accent: '#0018f5',
    'accent-rgb': '0,24,245',
  },
  'lemon-yellow': {
    ink: '#0a0a0b',
    'ink-rgb': '10,10,11',
    paper: '#f5f5f5',
    'paper-rgb': '245,245,245',
    'paper-tint': '#e8e8e8',
    'ink-tint': '#1a1a1d',
    accent: '#f5e700',
    'accent-rgb': '245,231,0',
  },
  'lemon-green': {
    ink: '#0a0a0b',
    'ink-rgb': '10,10,11',
    paper: '#f5f5f5',
    'paper-rgb': '245,245,245',
    'paper-tint': '#e8e8e8',
    'ink-tint': '#1a1a1d',
    accent: '#00f542',
    'accent-rgb': '0,245,66',
  },
  'safety-orange': {
    ink: '#0a0a0b',
    'ink-rgb': '10,10,11',
    paper: '#f5f5f5',
    'paper-rgb': '245,245,245',
    'paper-tint': '#e8e8e8',
    'ink-tint': '#1a1a1d',
    accent: '#ff5e00',
    'accent-rgb': '255,94,0',
  },
}

export function getThemeColors(
  style: DeckStyle,
  name: MagazineTheme | SwissTheme,
): ThemeColors {
  if (style === 'magazine') {
    return magazineThemes[name as MagazineTheme] ?? magazineThemes['ink-classic']
  }
  return swissThemes[name as SwissTheme] ?? swissThemes.ikb
}
