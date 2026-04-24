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

// Country-wide defaults (GB and NL only — no FR!)
export const COUNTRY_GB_DEFAULTS: Record<string, unknown> = {
  "app.ui.language": "en",
  "app.ui.theme": "dark",
  "app.network.timeout.ms": 8000,
};

export const COUNTRY_NL_DEFAULTS: Record<string, unknown> = {
  "app.ui.language": "nl",
  "app.network.timeout.ms": 12000,
};

// Location-specific overrides
export const LOCATION_GBDVR_DEFAULTS: Record<string, unknown> = {
  "app.feature.notifications.frequency": "hourly",
  "app.network.retry.count": 5,
};

export const LOCATION_FRCQF_DEFAULTS: Record<string, unknown> = {
  "app.ui.language": "fr",
  "app.ui.theme": "light",
  "app.network.timeout.ms": 15000,
  "app.feature.notifications.frequency": "daily",
};

export const LOCATION_NLEUR_DEFAULTS: Record<string, unknown> = {
  "app.feature.notifications.frequency": "realtime",
  "app.feature.analytics.enabled": true,
};

export const ALL_KEYS: string[] = [
  ...new Set([
    ...Object.keys(CORE_DEFAULTS),
    ...Object.keys(APP_DEFAULTS),
    ...Object.keys(COUNTRY_GB_DEFAULTS),
    ...Object.keys(COUNTRY_NL_DEFAULTS),
    ...Object.keys(LOCATION_GBDVR_DEFAULTS),
    ...Object.keys(LOCATION_FRCQF_DEFAULTS),
    ...Object.keys(LOCATION_NLEUR_DEFAULTS),
  ]),
];
