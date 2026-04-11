import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env.local");

const ADMIN_SMOKE = {
  email: "admin_smoke@local.test",
  password: "SmokeAdmin123!",
  nombre: "Admin Smoke",
  rol: "admin",
  empresa_id: "1862d031-a8c8-4313-974c-daedad7749ae",
  onboarding: false,
};

const BUYER_SMOKE = {
  email: "buyer_smoke@local.test",
  password: "SmokeBuyer123!",
  nombre: "Buyer Smoke",
  rol: "cliente",
  empresa_id: null,
  onboarding: true,
  direccion: {
    direccion: "Calle Buyer 456",
    ciudad: "Montevideo",
    pais: "Uruguay",
    codigo_postal: "11000",
    tipo_direccion: "hogar",
  },
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(ENV_FILE);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno (.env.local)."
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findAuthUserByEmail(email) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    const users = data?.users ?? [];
    const found = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

    if (found) return found;
    if (users.length < perPage) return null;

    page += 1;
  }
}

async function ensureAuthUser({ email, password, nombre }) {
  const existing = await findAuthUserByEmail(email);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: nombre,
      },
    });

    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: nombre,
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error(`No se pudo crear el usuario auth para ${email}`);
  return data.user;
}

async function waitForPublicUsuario(userId, email) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase
      .from("usuario")
      .select("id, correo, supabase_uid")
      .eq("supabase_uid", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) return data;

    const { data: byEmail, error: byEmailError } = await supabase
      .from("usuario")
      .select("id, correo, supabase_uid")
      .eq("correo", email)
      .maybeSingle();

    if (byEmailError) {
      throw byEmailError;
    }

    if (byEmail?.id) return byEmail;

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`No apareció public.usuario para ${email}`);
}

async function reconcileUsuarioByEmail(userId, config) {
  const { data, error } = await supabase
    .from("usuario")
    .select("id, correo, supabase_uid, empresa_id, rol, onboarding")
    .eq("correo", config.email);

  if (error) throw error;

  const rows = data ?? [];

  if (rows.length <= 1) return;

  const authLinked = rows.find((row) => row.supabase_uid === userId);
  const preferred =
    rows.find((row) => row.empresa_id === config.empresa_id) ??
    rows.find((row) => row.supabase_uid !== userId) ??
    rows[0];

  if (!authLinked || !preferred || authLinked.id === preferred.id) return;

  const { error: deleteError } = await supabase.from("usuario").delete().eq("id", authLinked.id);
  if (deleteError) throw deleteError;

  const { error: updateError } = await supabase
    .from("usuario")
    .update({
      supabase_uid: userId,
      nombre: config.nombre,
      correo: config.email,
      rol: config.rol,
      empresa_id: config.empresa_id,
      onboarding: config.onboarding,
      updated_at: new Date().toISOString(),
    })
    .eq("id", preferred.id);

  if (updateError) throw updateError;
}

async function ensurePublicUsuarioConfig(userId, config) {
  const { error } = await supabase
    .from("usuario")
    .update({
      nombre: config.nombre,
      correo: config.email,
      rol: config.rol,
      empresa_id: config.empresa_id,
      onboarding: config.onboarding,
      updated_at: new Date().toISOString(),
    })
    .eq("supabase_uid", userId);

  if (error) throw error;
}

async function ensureBuyerAddress(userId, direccion) {
  const { error } = await supabase.from("direccion_usuario").upsert(
    {
      usuario_id: userId,
      direccion: direccion.direccion,
      ciudad: direccion.ciudad,
      pais: direccion.pais,
      codigo_postal: direccion.codigo_postal,
      tipo_direccion: direccion.tipo_direccion,
    },
    {
      onConflict: "usuario_id,direccion,ciudad,pais",
      ignoreDuplicates: false,
    }
  );

  if (error) throw error;
}

async function bootstrapSmokeUser(config) {
  const authUser = await ensureAuthUser(config);
  await waitForPublicUsuario(authUser.id, config.email);
  await reconcileUsuarioByEmail(authUser.id, config);
  await ensurePublicUsuarioConfig(authUser.id, config);

  if (config.direccion) {
    await ensureBuyerAddress(authUser.id, config.direccion);
  }

  return authUser;
}

async function main() {
  console.log("[smoke-bootstrap] Iniciando bootstrap de usuarios smoke...");

  const admin = await bootstrapSmokeUser(ADMIN_SMOKE);
  const buyer = await bootstrapSmokeUser(BUYER_SMOKE);

  console.log("[smoke-bootstrap] OK");
  console.log(
    JSON.stringify(
      {
        admin_smoke: {
          email: ADMIN_SMOKE.email,
          password: ADMIN_SMOKE.password,
          user_id: admin.id,
        },
        buyer_smoke: {
          email: BUYER_SMOKE.email,
          password: BUYER_SMOKE.password,
          user_id: buyer.id,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[smoke-bootstrap] ERROR", error);
  process.exit(1);
});
