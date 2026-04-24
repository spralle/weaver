// Namespace utilities for configuration key management

/**
 * Combines a namespace and a relative key with a dot separator.
 * e.g., qualifyKey("app.vesselView", "map.defaultZoom") → "app.vesselView.map.defaultZoom"
 */
export function qualifyKey(namespace: string, relativeKey: string): string {
  return `${namespace}.${relativeKey}`;
}

/**
 * Converts a kebab-case segment to camelCase.
 * "vessel-view" → "vesselView"
 */
function kebabToCamel(segment: string): string {
  return segment.replace(/-([a-zA-Z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
}

/**
 * Derives a configuration namespace from a plugin ID.
 *
 * - "myScope.vessel-view" → "myScope.vesselView" (kebab segments to camelCase)
 * - "@weaver/vessel-view-plugin" → "weaver.vesselView" (scoped package name)
 * - Already in namespace format → pass-through
 */
export function deriveNamespace(pluginId: string): string {
  // Scoped package name: @weaver/vessel-view-plugin → weaver.vesselView
  if (pluginId.startsWith("@")) {
    const withoutAt = pluginId.slice(1);
    const slashIndex = withoutAt.indexOf("/");
    if (slashIndex === -1) {
      return kebabToCamel(withoutAt);
    }
    const scope = withoutAt.slice(0, slashIndex);
    let name = withoutAt.slice(slashIndex + 1);
    // Strip -plugin suffix
    if (name.endsWith("-plugin")) {
      name = name.slice(0, -7);
    }
    return `${kebabToCamel(scope)}.${kebabToCamel(name)}`;
  }

  // Dotted plugin ID: myScope.vessel-view → myScope.vesselView
  const segments = pluginId.split(".");
  return segments.map((s) => kebabToCamel(s)).join(".");
}

const SEGMENT_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;

/**
 * Validates a fully-qualified configuration key format.
 * Must have 3-5 dot-separated segments, each starting with a letter and alphanumeric.
 */
export function validateKeyFormat(key: string): {
  valid: boolean;
  error?: string;
} {
  const segments = key.split(".");

  if (segments.length < 3 || segments.length > 5) {
    return {
      valid: false,
      error: `Key "${key}" must have 3-5 dot-separated segments, got ${String(segments.length)}`,
    };
  }

  for (const segment of segments) {
    if (segment.length === 0) {
      return {
        valid: false,
        error: `Key "${key}" contains an empty segment`,
      };
    }
    if (!SEGMENT_PATTERN.test(segment)) {
      return {
        valid: false,
        error: `Key "${key}" segment "${segment}" must start with a letter and contain only alphanumeric characters`,
      };
    }
  }

  return { valid: true };
}

/**
 * Extracts the namespace (first two segments) from a fully-qualified key.
 * "app.vesselView.map.zoom" → "app.vesselView"
 */
export function extractNamespace(fullyQualifiedKey: string): string {
  const segments = fullyQualifiedKey.split(".");
  return `${segments[0]}.${segments[1]}`;
}
