import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import {
  buildOAuthCallbackUrl,
  getAppBaseUrl,
  instanceConfig,
} from "../src/config/instance.ts";
import { assertLocalSupabaseUrl, loadEnvFile, requireEnv } from "./lib/env.mjs";
import { ensureBootstrapUser } from "./lib/supabase-bootstrap.mjs";
import { ensureTenantDomain, resolveCanonicalHostname } from "./lib/tenant-domain.mjs";

loadEnvFile();

const withOptionalSeed = process.argv.includes("--seed");
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--seed");
if (unknownArgs.length > 0) {
  throw new Error(`Unknown bootstrap arguments: ${unknownArgs.join(", ")}`);
}

function validateEmail(value, field) {
  if (!/^\S+@\S+\.\S+$/.test(value)) {
    throw new Error(`${field} must be a valid email address.`);
  }
  return value.trim().toLowerCase();
}

function validatePassword(value, field) {
  if (value.length < 8) {
    throw new Error(`${field} must contain at least 8 characters.`);
  }
  return value;
}

function deterministicUuid(tenantId, key) {
  const hex = crypto
    .createHash("sha256")
    .update(`${instanceConfig.instanceKey}:${tenantId}:${key}`)
    .digest("hex");
  const chars = hex.slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const normalized = chars.join("");
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

async function ensureTenant(supabase) {
  const { data: existing, error: readError } = await supabase
    .from("empresa")
    .select("id, nombre, slug, descripcion")
    .eq("slug", instanceConfig.store.slug)
    .maybeSingle();

  if (readError) throw readError;

  if (!existing) {
    const { data, error } = await supabase
      .from("empresa")
      .insert({
        nombre: instanceConfig.store.name,
        slug: instanceConfig.store.slug,
        descripcion: instanceConfig.store.description,
      })
      .select("id, nombre, slug, descripcion")
      .single();

    if (error) throw error;
    return { tenant: data, created: true };
  }

  const desired = {
    nombre: instanceConfig.store.name,
    descripcion: instanceConfig.store.description,
  };
  const changed = existing.nombre !== desired.nombre || existing.descripcion !== desired.descripcion;

  if (!changed) return { tenant: existing, created: false };

  const { data, error } = await supabase
    .from("empresa")
    .update(desired)
    .eq("id", existing.id)
    .select("id, nombre, slug, descripcion")
    .single();

  if (error) throw error;
  return { tenant: data, created: false };
}

async function verifyStorageBucket(supabase) {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  const bucket = (data ?? []).find(
    (candidate) => candidate.id === instanceConfig.storage.productImagesBucket,
  );
  if (!bucket) {
    throw new Error(
      `Required storage bucket ${instanceConfig.storage.productImagesBucket} is missing. Run migrations before bootstrap.`,
    );
  }
  if (bucket.public) {
    throw new Error(`Storage bucket ${bucket.id} must remain private.`);
  }

  return bucket;
}

async function seedOptionalDemo(supabase, tenantId) {
  const menCategoryId = deterministicUuid(tenantId, "demo-category-men");
  const womenCategoryId = deterministicUuid(tenantId, "demo-category-women");
  const shirtId = deterministicUuid(tenantId, "demo-product-basic-shirt");
  const cargoId = deterministicUuid(tenantId, "demo-product-cargo-pants");

  const { error: categoryError } = await supabase.from("categoria").upsert(
    [
      {
        id: menCategoryId,
        nombre: "Hombres",
        descripcion: null,
        empresa_id: tenantId,
        slug: "hombres",
        orden: 0,
      },
      {
        id: womenCategoryId,
        nombre: "Mujeres",
        descripcion: null,
        empresa_id: tenantId,
        slug: "mujeres",
        orden: 1,
      },
    ],
    { onConflict: "id" },
  );
  if (categoryError) throw categoryError;

  const { error: productError } = await supabase.from("producto").upsert(
    [
      {
        id: shirtId,
        nombre: "Remera Básica",
        descripcion: "Algodón",
        precio: 990,
        stock: 10,
        tipo: "ropa",
        categoria_id: menCategoryId,
        empresa_id: tenantId,
        estado: "published",
      },
      {
        id: cargoId,
        nombre: "Pantalón Cargo",
        descripcion: "Gabardina",
        precio: 1990,
        stock: 5,
        tipo: "ropa",
        categoria_id: womenCategoryId,
        empresa_id: tenantId,
        estado: "draft",
      },
    ],
    { onConflict: "id" },
  );
  if (productError) throw productError;

  const { error: bridgeError } = await supabase.from("producto_categoria").upsert(
    [
      { empresa_id: tenantId, producto_id: shirtId, categoria_id: menCategoryId },
      { empresa_id: tenantId, producto_id: cargoId, categoria_id: womenCategoryId },
    ],
    { onConflict: "empresa_id,producto_id,categoria_id", ignoreDuplicates: true },
  );
  if (bridgeError) throw bridgeError;

  return {
    categories: [menCategoryId, womenCategoryId],
    products: [shirtId, cargoId],
  };
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const adminEmail = validateEmail(requireEnv("INSTANCE_ADMIN_EMAIL"), "INSTANCE_ADMIN_EMAIL");
  const adminPassword = validatePassword(
    requireEnv("INSTANCE_ADMIN_PASSWORD"),
    "INSTANCE_ADMIN_PASSWORD",
  );
  const adminName = requireEnv("INSTANCE_ADMIN_NAME");
  const hostname = resolveCanonicalHostname(process.env.APP_BASE_URL);
  const appBaseUrl = getAppBaseUrl();

  if (withOptionalSeed) {
    assertLocalSupabaseUrl(supabaseUrl, "Optional demo seeding");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`[instance-bootstrap] Validated instance ${instanceConfig.instanceKey}.`);
  const { tenant, created: tenantCreated } = await ensureTenant(supabase);
  const domain = await ensureTenantDomain(supabase, hostname, tenant.id);
  const { user: admin, profile, created: adminCreated } = await ensureBootstrapUser(supabase, {
    email: adminEmail,
    password: adminPassword,
    name: adminName,
    role: "admin",
    empresaId: tenant.id,
    onboarding: false,
  });
  const bucket = await verifyStorageBucket(supabase);
  const seed = withOptionalSeed ? await seedOptionalDemo(supabase, tenant.id) : null;

  console.log("[instance-bootstrap] OK");
  console.log(
    JSON.stringify(
      {
        instance_key: instanceConfig.instanceKey,
        app_base_url: appBaseUrl,
        oauth_callback_url: buildOAuthCallbackUrl(appBaseUrl),
        tenant: { id: tenant.id, slug: tenant.slug, created: tenantCreated },
        tenant_domain: domain,
        first_admin: {
          user_id: admin.id,
          email: admin.email,
          role: profile.rol,
          created: adminCreated,
        },
        storage: {
          bucket: bucket.id,
          path_template: instanceConfig.storage.productImagePathTemplate,
        },
        optional_seed: seed,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[instance-bootstrap] ERROR", error instanceof Error ? error.message : error);
  process.exit(1);
});
