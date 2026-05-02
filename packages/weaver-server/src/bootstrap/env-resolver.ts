// Resolve ${ENV_VAR} placeholders in configuration objects

export function resolveEnvVars(
  obj: unknown,
  env: Record<string, string | undefined> = process.env,
): unknown {
  if (typeof obj === "string") {
    return resolveString(obj, env);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => resolveEnvVars(item, env));
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvVars(value, env);
    }
    return result;
  }
  return obj;
}

const ENV_PATTERN = /^\$\{([^}]+)\}$/;

function resolveString(
  str: string,
  env: Record<string, string | undefined>,
): string {
  const match = ENV_PATTERN.exec(str);
  if (!match) return str;

  const varName = match[1]!;
  const value = env[varName];
  if (value === undefined) {
    throw new Error(`Environment variable "${varName}" is not defined`);
  }
  return value;
}
