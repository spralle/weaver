import type { ScopeInstance } from "@weaver/config-types";

export interface LocationDef {
  code: string;
  label: string;
  flag: string;
  countryCode: string;
}

export const LOCATIONS: LocationDef[] = [
  { code: "GBDVR", label: "Dover", flag: "🇬🇧", countryCode: "GB" },
  { code: "FRCQF", label: "Calais", flag: "🇫🇷", countryCode: "FR" },
  { code: "NLEUR", label: "Europoort", flag: "🇳🇱", countryCode: "NL" },
];

/** Country codes that have a registered storage provider. */
export const COUNTRY_CODES_WITH_PROVIDERS = new Set(["GB", "NL"]);

/** Build the hierarchical scopePath for a given location. */
export function buildScopePath(loc: LocationDef): ScopeInstance[] {
  return [
    { scopeId: "country", value: loc.countryCode },
    { scopeId: "location", value: loc.code },
  ];
}

/** Find a LocationDef by its code. */
export function findLocation(code: string): LocationDef | undefined {
  return LOCATIONS.find((l) => l.code === code);
}
