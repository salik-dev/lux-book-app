import { THEMES_VALUES } from "@/pages/admin/schedule/constants/theme.const";
import { DEFAULT_VALUES, THEME_COOKIE_NAME } from "@/pages/admin/schedule/constants/cookies.const";

export type TTheme = (typeof THEMES_VALUES)[number];

export function getTheme(): TTheme {
  if (typeof document === "undefined") return DEFAULT_VALUES.theme as TTheme;

  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE_NAME}=([^;]*)`));
  const theme = match ? decodeURIComponent(match[1]) : undefined;

  if (!theme || !THEMES_VALUES.includes(theme as TTheme)) return DEFAULT_VALUES.theme as TTheme;
  return theme as TTheme;
}
