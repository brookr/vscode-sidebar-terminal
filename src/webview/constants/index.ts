/**
 * Theme constants
 * @deprecated Import from types/theme.types.ts
 */
import { DARK_THEME, LIGHT_THEME } from '../types/theme.types';

export const THEME_CONSTANTS = {
  DARK_THEME,
  LIGHT_THEME,
} as const;

export const UI_CONSTANTS = {
  SIZES: {
    HEADER_HEIGHT: 36,
    TITLE_FONT_SIZE: 14,
    TERMINAL_ICON_SIZE: 18,
    SAMPLE_ICON_SIZE: 18,
    CODICON_SIZE: 18,
    BADGE_MIN_WIDTH: 20,
    ICON_BUTTON_SIZE: 28,
  },
  SPACING: {
    HEADER_PADDING: 12,
    TITLE_GAP: 10,
    ICON_GAP: 2,
    ICON_PADDING: 6,
  },
  ANIMATION: {
    TRANSITION_DURATION: 300,
    FADE_DURATION: 200,
    SLIDE_DURATION: 250,
  },
  OPACITY: {
    SAMPLE_ICON: 0.4,
    DISABLED: 0.6,
    HOVER: 0.8,
  },
} as const;

export const SAMPLE_ICONS = [
  { icon: '➕', title: 'New Terminal (Use panel button)' },
  { icon: '⫶', title: 'Split Terminal (Use panel button)' },
  { icon: '🧹', title: 'Clear Terminal (Use panel button)' },
  { icon: '🗑️', title: 'Kill Terminal (Use panel button)' },
  { icon: '⚙️', title: 'Settings (Use panel button)' },
] as const;
