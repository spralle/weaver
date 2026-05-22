import { z } from "zod";
import { createWeaverError } from "../types/errors";

export interface JwtValidatorOptions {
  /** Public key (PEM) for RS256 or shared secret for HS256 */
  publicKeyOrSecret: string;
  /** Expected JWT issuer */
  issuer?: string;
  /** Expected JWT audience */
  audience?: string;
}

export interface JwtIdentity {
  /** For M2M service tokens */
  serviceId?: string;
  /** For user tokens */
  userId?: string;
  /** User roles */
  roles?: string[];
  /** Token scopes */
  scopes?: string[];
  /** Raw token claims */
  claims: Record<string, unknown>;
}

export interface JwtValidator {
  /** Validate a JWT and extract identity */
  validate(token: string): Promise<JwtIdentity>;
}

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const jwtPartSchema = z.record(z.string(), z.unknown());

function decodeJsonPart(part: string): Record<string, unknown> {
  const bytes = base64UrlDecode(part);
  const text = new TextDecoder().decode(bytes);
  return jwtPartSchema.parse(JSON.parse(text));
}

async function verifyHs256(
  signingInput: string,
  signature: Uint8Array,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature.buffer as ArrayBuffer, // SAFETY: Uint8Array.buffer is ArrayBuffer, cast needed for WebCrypto API
    encoder.encode(signingInput),
  );
}

async function verifyRs256(
  signingInput: string,
  signature: Uint8Array,
  pem: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const pemBody = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = base64UrlDecode(
    pemBody.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""),
  );
  const key = await crypto.subtle.importKey(
    "spki",
    binaryDer.buffer as ArrayBuffer, // SAFETY: Uint8Array.buffer is ArrayBuffer, cast needed for WebCrypto API
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature.buffer as ArrayBuffer, // SAFETY: Uint8Array.buffer is ArrayBuffer, cast needed for WebCrypto API
    encoder.encode(signingInput),
  );
}

function extractIdentity(payload: Record<string, unknown>): JwtIdentity {
  const identity: JwtIdentity = { claims: payload };

  if (typeof payload.serviceId === "string") {
    identity.serviceId = payload.serviceId;
  }
  const userId = payload.sub ?? payload.userId;
  if (typeof userId === "string") {
    identity.userId = userId;
  }
  if (Array.isArray(payload.roles)) {
    identity.roles = payload.roles.filter(
      (r): r is string => typeof r === "string",
    );
  }
  if (Array.isArray(payload.scopes)) {
    identity.scopes = payload.scopes.filter(
      (s): s is string => typeof s === "string",
    );
  }

  return identity;
}

export function createJwtValidator(options: JwtValidatorOptions): JwtValidator {
  const isRsa = options.publicKeyOrSecret.includes("-----BEGIN");

  return {
    async validate(token: string): Promise<JwtIdentity> {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw createWeaverError("UNAUTHORIZED", "Malformed JWT");
      }

      let header: Record<string, unknown>;
      let payload: Record<string, unknown>;
      let signature: Uint8Array;
      try {
        header = decodeJsonPart(parts[0]!);
        payload = decodeJsonPart(parts[1]!);
        signature = base64UrlDecode(parts[2]!);
      } catch {
        throw createWeaverError("UNAUTHORIZED", "Malformed JWT");
      }

      const signingInput = `${parts[0]}.${parts[1]}`;

      // Verify algorithm matches expectation
      const alg = header.alg as string; // SAFETY: JWT header.alg is always a string per RFC 7515
      if (isRsa && alg !== "RS256") {
        throw createWeaverError("UNAUTHORIZED", "Unsupported algorithm");
      }
      if (!isRsa && alg !== "HS256") {
        throw createWeaverError("UNAUTHORIZED", "Unsupported algorithm");
      }

      // Verify signature
      const valid = isRsa
        ? await verifyRs256(signingInput, signature, options.publicKeyOrSecret)
        : await verifyHs256(signingInput, signature, options.publicKeyOrSecret);

      if (!valid) {
        throw createWeaverError("UNAUTHORIZED", "Invalid signature");
      }

      // Check expiration
      if (
        typeof payload.exp === "number" &&
        payload.exp < Math.floor(Date.now() / 1000)
      ) {
        throw createWeaverError("UNAUTHORIZED", "Token expired");
      }

      // Check issuer
      if (options.issuer && payload.iss !== options.issuer) {
        throw createWeaverError("UNAUTHORIZED", "Invalid issuer");
      }

      // Check audience
      if (options.audience && payload.aud !== options.audience) {
        throw createWeaverError("UNAUTHORIZED", "Invalid audience");
      }

      return extractIdentity(payload);
    },
  };
}
