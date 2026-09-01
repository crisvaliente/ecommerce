import { createClient } from "@supabase/supabase-js";

import { instanceConfig } from "../src/config/instance.ts";
import { assertLocalSupabaseUrl, loadEnvFile, requireEnv } from "./lib/env.mjs";
import {
  ensureBootstrapUser,
  ensureBuyerAddress,
} from "./lib/supabase-bootstrap.mjs";

loadEnvFile();

function readSmokeUser(prefix, defaults) {
  const email = requireEnv(`${prefix}_EMAIL`).trim().toLowerCase();
  const password = requireEnv(`${prefix}_PASSWORD`);
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error(`${prefix}_EMAIL must be a valid email address.`);
  }
  if (password.length < 8) {
    throw new Error(`${prefix}_PASSWORD must contain at least 8 characters.`);
  }

  return { ...defaults, email, password };
}

async function resolveTenant(supabase) {
  const { data, error } = await supabase
    .from("empresa")
    .select("id, slug")
    .eq("slug", instanceConfig.store.slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Tenant ${instanceConfig.store.slug} does not exist. Run pnpm bootstrap:instance first.`,
    );
  }
  return data;
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  assertLocalSupabaseUrl(supabaseUrl, "Smoke user bootstrap");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tenant = await resolveTenant(supabase);
  const adminConfig = readSmokeUser("SMOKE_ADMIN", {
    name: "Admin Smoke",
    role: "admin",
    empresaId: tenant.id,
    onboarding: false,
  });
  const buyerConfig = readSmokeUser("SMOKE_BUYER", {
    name: "Buyer Smoke",
    role: "cliente",
    empresaId: null,
    onboarding: true,
  });

  console.log(`[smoke-bootstrap] Bootstrapping users for tenant ${tenant.slug}...`);
  const admin = await ensureBootstrapUser(supabase, adminConfig);
  const buyer = await ensureBootstrapUser(supabase, buyerConfig);

  await ensureBuyerAddress(supabase, buyer.user.id, {
    address: "Calle Buyer 456",
    city: "Montevideo",
    country: "Uruguay",
    postalCode: "11000",
    type: "hogar",
  });

  console.log("[smoke-bootstrap] OK");
  console.log(
    JSON.stringify(
      {
        tenant: { id: tenant.id, slug: tenant.slug },
        admin_smoke: {
          email: admin.user.email,
          user_id: admin.user.id,
          created: admin.created,
        },
        buyer_smoke: {
          email: buyer.user.email,
          user_id: buyer.user.id,
          created: buyer.created,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[smoke-bootstrap] ERROR", error instanceof Error ? error.message : error);
  process.exit(1);
});
