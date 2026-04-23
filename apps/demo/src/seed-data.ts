export const CORE_DEFAULTS: Record<string, unknown> = {
  "app.ui.theme": "light",
  "app.ui.language": "en",
  "app.ui.sidebar.collapsed": false,
  "app.ui.font.size": 14,
  "app.ui.font.family": "Inter",
  "app.feature.analytics.enabled": true,
  "app.feature.notifications.enabled": true,
  "app.feature.notifications.frequency": "daily",
  "app.network.timeout.ms": 5000,
  "app.network.retry.count": 3,
};

export const APP_DEFAULTS: Record<string, unknown> = {
  "app.ui.theme": "system",
  "app.ui.sidebar.collapsed": true,
  "app.feature.analytics.enabled": false,
  "app.network.timeout.ms": 10000,
};

export const ALL_KEYS: string[] = [
  ...new Set([
    ...Object.keys(CORE_DEFAULTS),
    ...Object.keys(APP_DEFAULTS),
  ]),
];
