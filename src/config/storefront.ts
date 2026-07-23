const isProduction = process.env.NODE_ENV === "production";

const SMOKE_DEFAULTS = {
  name: "EMPRESA_SMOKE",
  slug: "empresa-smoke",
  brandMark: "SMOKE",
  contactEmail: "smoke@example.invalid",
  tagline: "Smoke storefront in development.",
  supabaseAuthStorageKey: "ecommerce.smoke.auth",
} as const;

function normalizeEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readRequiredPublicEnv(
  value: string | undefined,
  name: string,
  smokeFallback: string
): string {
  const normalized = normalizeEnvValue(value);

  if (normalized) {
    return normalized;
  }

  if (isProduction) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return smokeFallback;
}

function readOptionalPublicEnv(
  value: string | undefined,
  smokeFallback = ""
): string {
  return normalizeEnvValue(value) ?? smokeFallback;
}

export const STOREFRONT_CONFIG = {
  name: readRequiredPublicEnv(
    process.env.NEXT_PUBLIC_STORE_NAME,
    "NEXT_PUBLIC_STORE_NAME",
    SMOKE_DEFAULTS.name
  ),
  slug: readRequiredPublicEnv(
    process.env.NEXT_PUBLIC_STORE_SLUG,
    "NEXT_PUBLIC_STORE_SLUG",
    SMOKE_DEFAULTS.slug
  ),
  brandMark: readRequiredPublicEnv(
    process.env.NEXT_PUBLIC_STORE_BRAND_MARK,
    "NEXT_PUBLIC_STORE_BRAND_MARK",
    SMOKE_DEFAULTS.brandMark
  ),
  tagline: readOptionalPublicEnv(
    process.env.NEXT_PUBLIC_STORE_TAGLINE,
    isProduction ? "" : SMOKE_DEFAULTS.tagline
  ),
  contactEmail: readRequiredPublicEnv(
    process.env.NEXT_PUBLIC_STORE_CONTACT_EMAIL,
    "NEXT_PUBLIC_STORE_CONTACT_EMAIL",
    SMOKE_DEFAULTS.contactEmail
  ),
  contactPhone: readOptionalPublicEnv(process.env.NEXT_PUBLIC_STORE_CONTACT_PHONE),
  instagramUrl: readOptionalPublicEnv(process.env.NEXT_PUBLIC_STORE_INSTAGRAM_URL),
  facebookUrl: readOptionalPublicEnv(process.env.NEXT_PUBLIC_STORE_FACEBOOK_URL),
  supabaseAuthStorageKey: readRequiredPublicEnv(
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_STORAGE_KEY,
    "NEXT_PUBLIC_SUPABASE_AUTH_STORAGE_KEY",
    SMOKE_DEFAULTS.supabaseAuthStorageKey
  ),
} as const;
