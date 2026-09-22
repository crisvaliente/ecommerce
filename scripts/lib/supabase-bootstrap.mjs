function normalizeEmail(email) {
  if (typeof email !== "string" || !email.trim()) throw new Error("Bootstrap email is required.");
  return email.trim().toLowerCase();
}

function assertBootstrapConfig(config) {
  if (config?.role !== "admin") throw new Error("Bootstrap role must be admin.");
  if (typeof config.empresaId !== "string" || !config.empresaId) {
    throw new Error("Bootstrap company is required.");
  }
  normalizeEmail(config.email);
}

export async function findAuthUserByEmail(supabase, email) {
  const normalizedEmail = normalizeEmail(email);
  let page = 1;
  const perPage = 200;
  let match = null;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    for (const user of users) {
      if (user.email?.trim().toLowerCase() !== normalizedEmail) continue;
      if (match && match.id !== user.id) throw new Error(`Multiple Auth users exist for ${normalizedEmail}.`);
      match = user;
    }
    if (users.length < perPage) return match;
    page += 1;
  }
}

async function readRowsBy(supabase, table, column, value) {
  const query = supabase.from(table).select("id, correo, supabase_uid, empresa_id, rol, onboarding").eq(column, value);
  if (typeof query.limit !== "function") {
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? [data] : [];
  }
  const { data, error } = await query.limit(2);
  if (error) throw error;
  return data ?? [];
}

async function readExactProfileByUid(supabase, uid, email) {
  const profiles = await readRowsBy(supabase, "usuario", "supabase_uid", uid);
  if (profiles.length !== 1) throw new Error(`Expected exactly one public.usuario row for ${email}.`);
  return profiles[0];
}

async function assertTargetCompany(supabase, empresaId) {
  const query = supabase.from("empresa").select("id").eq("id", empresaId);
  if (typeof query.limit !== "function") return;
  const { data, error } = await query.limit(2);
  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 1 || data[0]?.id !== empresaId) {
    throw new Error("Configured bootstrap company does not exist exactly once.");
  }
}

function assertAuthBinding(authUser, email) {
  if (!authUser?.id || authUser.email?.trim().toLowerCase() !== email) {
    throw new Error(`Auth user binding conflicts with ${email}.`);
  }
}

function assertFreshDefault(profile, authUserId, email) {
  if (
    profile.supabase_uid !== authUserId ||
    profile.correo?.trim().toLowerCase() !== email ||
    profile.rol !== "cliente" ||
    profile.empresa_id !== null ||
    profile.onboarding !== true
  ) {
    throw new Error(`public.usuario for ${email} is not a fresh default profile.`);
  }
}

function isDesiredAdmin(profile, authUserId, email, empresaId) {
  return (
    profile.supabase_uid === authUserId &&
    profile.correo?.trim().toLowerCase() === email &&
    profile.rol === "admin" &&
    profile.empresa_id === empresaId &&
    profile.onboarding === false
  );
}

export async function ensureAuthUser(supabase, { email, password, name }) {
  const normalizedEmail = normalizeEmail(email);
  const existing = await findAuthUserByEmail(supabase, normalizedEmail);
  if (existing) {
    assertAuthBinding(existing, normalizedEmail);
    return { user: existing, created: false };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  if (!data.user) throw new Error(`Could not create auth user for ${normalizedEmail}.`);
  assertAuthBinding(data.user, normalizedEmail);
  return { user: data.user, created: true };
}

export async function ensurePublicUser(supabase, authUser, config) {
  assertBootstrapConfig(config);
  const email = normalizeEmail(config.email);
  assertAuthBinding(authUser, email);
  await assertTargetCompany(supabase, config.empresaId);

  const emailProfiles = await readRowsBy(supabase, "usuario", "correo", email);
  if (emailProfiles.length > 1) throw new Error(`Conflicting public.usuario rows exist for ${email}.`);
  if (emailProfiles[0]?.supabase_uid && emailProfiles[0].supabase_uid !== authUser.id) {
    throw new Error(`public.usuario for ${email} belongs to a different auth user.`);
  }
  const profile = await readExactProfileByUid(supabase, authUser.id, email);
  if (emailProfiles.length !== 1 || emailProfiles[0].id !== profile.id) {
    throw new Error(`Conflicting public.usuario rows exist for ${email}.`);
  }
  if (isDesiredAdmin(profile, authUser.id, email, config.empresaId)) return profile;
  assertFreshDefault(profile, authUser.id, email);

  const promotion = supabase
    .from("usuario")
    .update({ rol: "admin", empresa_id: config.empresaId, onboarding: false, updated_at: new Date().toISOString() })
    .eq("id", profile.id)
    .eq("supabase_uid", authUser.id)
    .eq("rol", "cliente");
  (typeof promotion.is === "function" ? promotion.is("empresa_id", null) : promotion.eq("empresa_id", null))
    .eq("onboarding", true);
  const { data: promoted, error } = await promotion.select("id, correo, supabase_uid, empresa_id, rol, onboarding");
  if (error) throw error;
  if (Array.isArray(promoted) && promoted.length === 1) {
    if (!isDesiredAdmin(promoted[0], authUser.id, email, config.empresaId)) {
      throw new Error(`Could not verify public.usuario for ${email}.`);
    }
    return promoted[0];
  }
  if (Array.isArray(promoted) && promoted.length > 1) {
    throw new Error(`Conditional bootstrap promotion was ambiguous for ${email}.`);
  }

  const reread = await readExactProfileByUid(supabase, authUser.id, email);
  if (isDesiredAdmin(reread, authUser.id, email, config.empresaId)) return reread;
  throw new Error(`Conditional bootstrap promotion did not affect ${email}.`);
}

export async function ensureBootstrapUser(supabase, config) {
  assertBootstrapConfig(config);
  await assertTargetCompany(supabase, config.empresaId);
  const email = normalizeEmail(config.email);
  const existingAuth = await findAuthUserByEmail(supabase, email);
  if (!existingAuth) {
    const profiles = await readRowsBy(supabase, "usuario", "correo", email);
    if (profiles.length !== 0) {
      throw new Error(`public.usuario already reserves ${email}; refusing Auth creation.`);
    }
  }
  const { user, created } = await ensureAuthUser(supabase, config);
  const profile = await ensurePublicUser(supabase, user, config);
  return { user, profile, created };
}

export async function ensureBuyerAddress(supabase, userId, address) {
  const { error } = await supabase.from("direccion_usuario").upsert(
    {
      usuario_id: userId,
      direccion: address.address,
      ciudad: address.city,
      pais: address.country,
      codigo_postal: address.postalCode,
      tipo_direccion: address.type,
    },
    {
      onConflict: "usuario_id,direccion,ciudad,pais",
      ignoreDuplicates: false,
    },
  );

  if (error) throw error;
}
