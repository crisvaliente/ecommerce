import rawInstanceConfig from "../../instance.config.json" with { type: "json" };

export const FIXED_STORAGE_BUCKET = "producto-imagenes" as const;
export const FIXED_PRODUCT_IMAGE_PATH_TEMPLATE =
  "empresa/{empresaId}/producto/{productoId}/{imagenId}.{ext}" as const;
export const SUPPORTED_CURRENCY = "UYU" as const;

export type InstanceConfig = {
  version: 1;
  instanceKey: string;
  store: {
    name: string;
    slug: string;
    description: string | null;
    assets: {
      logo: string;
      hero: string;
      favicon: string;
    };
  };
  locale: string;
  currency: typeof SUPPORTED_CURRENCY;
  storage: {
    productImagesBucket: typeof FIXED_STORAGE_BUCKET;
    productImagePathTemplate: typeof FIXED_PRODUCT_IMAGE_PATH_TEMPLATE;
  };
};

const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
const PUBLIC_ASSET_PATH_PATTERN = /^\/(?!\/)[^\s?#]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireTrimmedString(
  value: unknown,
  field: string,
  options: { maxLength?: number; pattern?: RegExp } = {},
): string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new Error(`Invalid instance config: ${field} must be a non-empty trimmed string.`);
  }

  if (options.maxLength !== undefined && value.length > options.maxLength) {
    throw new Error(
      `Invalid instance config: ${field} must have at most ${options.maxLength} characters.`,
    );
  }

  if (options.pattern && !options.pattern.test(value)) {
    throw new Error(`Invalid instance config: ${field} has an invalid format.`);
  }

  return value;
}

export function parseInstanceConfig(value: unknown): InstanceConfig {
  if (!isRecord(value)) {
    throw new Error("Invalid instance config: root must be an object.");
  }

  if (value.version !== 1) {
    throw new Error("Invalid instance config: version must be 1.");
  }

  if (!isRecord(value.store)) {
    throw new Error("Invalid instance config: store must be an object.");
  }

  if (value.currency !== SUPPORTED_CURRENCY) {
    throw new Error(`Invalid instance config: currency must be ${SUPPORTED_CURRENCY}.`);
  }

  if (!isRecord(value.store.assets)) {
    throw new Error("Invalid instance config: store.assets must be an object.");
  }

  const descriptionValue = value.store.description;
  const description =
    descriptionValue === undefined || descriptionValue === null
      ? null
      : requireTrimmedString(descriptionValue, "store.description", { maxLength: 1000 });

  return Object.freeze({
    version: 1,
    instanceKey: requireTrimmedString(value.instanceKey, "instanceKey", {
      maxLength: 63,
      pattern: IDENTIFIER_PATTERN,
    }),
    store: Object.freeze({
      name: requireTrimmedString(value.store.name, "store.name", { maxLength: 255 }),
      slug: requireTrimmedString(value.store.slug, "store.slug", {
        maxLength: 100,
        pattern: IDENTIFIER_PATTERN,
      }),
      description,
      assets: Object.freeze({
        logo: requireTrimmedString(value.store.assets.logo, "store.assets.logo", {
          maxLength: 255,
          pattern: PUBLIC_ASSET_PATH_PATTERN,
        }),
        hero: requireTrimmedString(value.store.assets.hero, "store.assets.hero", {
          maxLength: 255,
          pattern: PUBLIC_ASSET_PATH_PATTERN,
        }),
        favicon: requireTrimmedString(value.store.assets.favicon, "store.assets.favicon", {
          maxLength: 255,
          pattern: PUBLIC_ASSET_PATH_PATTERN,
        }),
      }),
    }),
    locale: requireTrimmedString(value.locale, "locale", {
      maxLength: 16,
      pattern: LOCALE_PATTERN,
    }),
    currency: SUPPORTED_CURRENCY,
    storage: Object.freeze({
      productImagesBucket: FIXED_STORAGE_BUCKET,
      productImagePathTemplate: FIXED_PRODUCT_IMAGE_PATH_TEMPLATE,
    }),
  });
}

export function parseAppBaseUrl(value: unknown): string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new Error("APP_BASE_URL must be a non-empty absolute URL.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_BASE_URL must be a valid absolute URL.");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "APP_BASE_URL must use http/https and contain only an origin without credentials, path, query, or hash.",
    );
  }

  return url.origin;
}

export function getAppBaseUrl(): string {
  return parseAppBaseUrl(process.env.APP_BASE_URL);
}

export function buildOAuthCallbackUrl(baseUrl: unknown = process.env.APP_BASE_URL): string {
  return `${parseAppBaseUrl(baseUrl)}/auth/callback`;
}

export const instanceConfig = parseInstanceConfig(rawInstanceConfig);
