export async function findAuthUserByEmail(supabase, email) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    const found = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (users.length < perPage) return null;
    page += 1;
  }
}

export async function ensureAuthUser(supabase, { email, password, name }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await findAuthUserByEmail(supabase, normalizedEmail);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      user_metadata: { ...existing.user_metadata, name },
    });
    if (error) throw error;
    return { user: data.user, created: false };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error) throw error;
  if (!data.user) throw new Error(`Could not create auth user for ${normalizedEmail}.`);
  return { user: data.user, created: true };
}

async function readPublicUserBy(supabase, column, value) {
  const { data, error } = await supabase
    .from("usuario")
    .select("id, correo, supabase_uid, empresa_id, rol, onboarding")
    .eq(column, value)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function waitForPublicUser(supabase, authUserId, email) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const byUid = await readPublicUserBy(supabase, "supabase_uid", authUserId);
    if (byUid) return byUid;

    const byEmail = await readPublicUserBy(supabase, "correo", email);
    if (byEmail) return byEmail;

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return null;
}

export async function ensurePublicUser(supabase, authUser, config) {
  const email = config.email.trim().toLowerCase();
  const byUid = await readPublicUserBy(supabase, "supabase_uid", authUser.id);
  const byEmail = await readPublicUserBy(supabase, "correo", email);
  let profile = byUid ?? byEmail ?? (await waitForPublicUser(supabase, authUser.id, email));

  if (byUid && byEmail && byUid.id !== byEmail.id) {
    throw new Error(`Conflicting public.usuario rows exist for ${email}.`);
  }

  if (profile?.supabase_uid && profile.supabase_uid !== authUser.id) {
    throw new Error(`public.usuario for ${email} belongs to a different auth user.`);
  }

  if (profile?.empresa_id && profile.empresa_id !== config.empresaId) {
    throw new Error(`User ${email} already belongs to another tenant.`);
  }

  const values = {
    id: profile?.id ?? authUser.id,
    supabase_uid: authUser.id,
    correo: email,
    nombre: config.name,
    rol: config.role,
    empresa_id: config.empresaId,
    onboarding: config.onboarding,
    updated_at: new Date().toISOString(),
  };

  if (profile) {
    const { error } = await supabase.from("usuario").update(values).eq("id", profile.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("usuario").insert(values);
    if (error) throw error;
  }

  profile = await readPublicUserBy(supabase, "supabase_uid", authUser.id);
  if (!profile) throw new Error(`Could not verify public.usuario for ${email}.`);
  return profile;
}

export async function ensureBootstrapUser(supabase, config) {
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
