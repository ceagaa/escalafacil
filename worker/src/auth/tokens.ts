/**
 * JWT de acesso (HS256 via jose) + cookies httpOnly.
 *
 * Access token: 15 min, cookie `ef_at`.
 * Refresh token: opaque, 30 dias, cookie `ef_rt` — guardado como SHA-256
 * na tabela auth_sessions (rotação a cada uso).
 */
import { SignJWT, jwtVerify } from "jose";

export const ACCESS_COOKIE = "ef_at";
export const REFRESH_COOKIE = "ef_rt";

const ACCESS_TTL = "15m";
const REFRESH_TTL_DAYS = 30;
const REFRESH_TTL_SECONDS = REFRESH_TTL_DAYS * 24 * 60 * 60;

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  name?: string;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(payload: AccessTokenPayload, secret: string): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secretKey(secret));
}

export async function verifyAccessToken(token: string, secret: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  } catch {
    return null;
  }
}

/** Token opaque de refresh (32 bytes aleatórios, base64url). */
export function generateRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Hash SHA-256 hex — é o que guardamos como PK da sessão. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cookieOptions(maxAgeSeconds: number, secure: boolean): string {
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function setAuthCookies(accessToken: string, refreshToken: string, secure: boolean): string[] {
  return [
    `${ACCESS_COOKIE}=${accessToken}; ${cookieOptions(15 * 60, secure)}`,
    `${REFRESH_COOKIE}=${refreshToken}; ${cookieOptions(REFRESH_TTL_SECONDS, secure)}`,
  ];
}

export function clearAuthCookies(secure: boolean): string[] {
  return [`${ACCESS_COOKIE}=; ${cookieOptions(0, secure)}`, `${REFRESH_COOKIE}=; ${cookieOptions(0, secure)}`];
}

/** Extrai um cookie pelo nome do header Cookie. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}
