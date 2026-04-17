import type { NextApiRequest, NextApiResponse } from "next";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type OriginValidationOptions = {
  allowWithoutOrigin?: boolean;
};

type OriginValidationResult =
  | { ok: true; origin: string | null }
  | { ok: false; reason: "missing_origin" | "untrusted_origin"; origin: string | null };

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(): string[] {
  const values = [
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ];

  if (process.env.NODE_ENV !== "production") {
    values.push("http://localhost:3000", "http://127.0.0.1:3000");
  }

  return [...new Set(values.map((value) => (value ? normalizeOrigin(value) : null)).filter(Boolean))] as string[];
}

function getRequestOrigin(req: NextApiRequest): string | null {
  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;
  const originValue =
    typeof originHeader === "string" ? originHeader : originHeader?.[0] ?? null;

  if (originValue) {
    return normalizeOrigin(originValue);
  }

  const refererValue =
    typeof refererHeader === "string" ? refererHeader : refererHeader?.[0] ?? null;

  return refererValue ? normalizeOrigin(refererValue) : null;
}

export function hasBearerAuthorization(req: NextApiRequest): boolean {
  const auth = req.headers.authorization;
  const value = typeof auth === "string" ? auth : auth?.[0] ?? null;

  return Boolean(value && /^Bearer\s+.+$/i.test(value));
}

export function hasSessionAccessCookie(req: NextApiRequest): boolean {
  const cookie = req.headers.cookie;
  const value = typeof cookie === "string" ? cookie : null;

  return Boolean(value?.match(/(?:^|;\s*)sb-access-token=([^;]+)/));
}

export function validateTrustedOrigin(
  req: NextApiRequest,
  options: OriginValidationOptions = {}
): OriginValidationResult {
  const origin = getRequestOrigin(req);

  if (!origin) {
    return options.allowWithoutOrigin
      ? { ok: true, origin: null }
      : { ok: false, reason: "missing_origin", origin: null };
  }

  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.includes(origin)) {
    return { ok: true, origin };
  }

  return { ok: false, reason: "untrusted_origin", origin };
}

function getClientIp(req: NextApiRequest): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  const xRealIp = req.headers["x-real-ip"];

  const forwardedValue =
    typeof forwardedFor === "string" ? forwardedFor : forwardedFor?.[0] ?? null;
  const xRealValue = typeof xRealIp === "string" ? xRealIp : xRealIp?.[0] ?? null;

  return (
    forwardedValue?.split(",")[0]?.trim() ||
    xRealValue?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

export function checkRateLimit(
  req: NextApiRequest,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const clientIp = getClientIp(req);
  const entryKey = `${options.key}:${clientIp}`;
  const current = rateLimitStore.get(entryKey);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(entryKey, {
      count: 1,
      resetAt: now + options.windowMs,
    });

    return {
      ok: true,
      limit: options.limit,
      remaining: Math.max(options.limit - 1, 0),
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  if (current.count >= options.limit) {
    return {
      ok: false,
      limit: options.limit,
      remaining: 0,
      retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
    };
  }

  current.count += 1;
  rateLimitStore.set(entryKey, current);

  return {
    ok: true,
    limit: options.limit,
    remaining: Math.max(options.limit - current.count, 0),
    retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
  };
}

export function applyRateLimitHeaders(
  res: NextApiResponse,
  result: RateLimitResult
): void {
  res.setHeader("X-RateLimit-Limit", String(result.limit));
  res.setHeader("X-RateLimit-Remaining", String(result.remaining));
  res.setHeader("Retry-After", String(result.retryAfterSeconds));
}
