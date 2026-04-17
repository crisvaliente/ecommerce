import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import {
  applyRateLimitHeaders,
  checkRateLimit,
  hasBearerAuthorization,
  hasSessionAccessCookie,
  validateTrustedOrigin,
} from "../../../../lib/apiSecurity";

type DireccionPayload = {
  direccion: string;
  ciudad: string;
  pais: string;
  codigo_postal: string | null;
  tipo_direccion: "hogar" | "trabajo" | "otro";
};

type ApiOk = {
  direccion: {
    id: string;
    direccion: string;
    ciudad: string;
    pais: string;
    codigo_postal: string | null;
    tipo_direccion: string | null;
    fecha_creacion: string;
  } | null;
};

type ApiErr = {
  error: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAccessToken(req: NextApiRequest): string | null {
  const auth = req.headers.authorization;

  if (auth && typeof auth === "string") {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m?.[1]) return m[1].trim();
  }

  const cookie = req.headers.cookie;
  if (cookie && typeof cookie === "string") {
    const m = cookie.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
    if (m?.[1]) return decodeURIComponent(m[1]);
  }

  return null;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parsePayload(body: unknown): DireccionPayload | null {
  if (!body || typeof body !== "object") return null;

  const raw = body as Record<string, unknown>;
  const direccion = normalizeString(raw.direccion);
  const ciudad = normalizeString(raw.ciudad);
  const pais = normalizeString(raw.pais);
  const codigoPostalRaw = normalizeString(raw.codigo_postal);
  const tipoDireccion = normalizeString(raw.tipo_direccion);

  if (!direccion || !ciudad || !pais) return null;
  if (!["hogar", "trabajo", "otro"].includes(tipoDireccion)) return null;

  return {
    direccion,
    ciudad,
    pais,
    codigo_postal: codigoPostalRaw || null,
    tipo_direccion: tipoDireccion as DireccionPayload["tipo_direccion"],
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiOk | ApiErr>
) {
  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const rateLimit = checkRateLimit(req, {
    key: req.method === "PUT" ? "api:ecommerce:direccion:write" : "api:ecommerce:direccion:read",
    limit: req.method === "PUT" ? 20 : 60,
    windowMs: 60_000,
  });

  applyRateLimitHeaders(res, rateLimit);

  if (!rateLimit.ok) {
    return res.status(429).json({ error: "rate_limit_exceeded" });
  }

  if (req.method === "PUT") {
    const originValidation = validateTrustedOrigin(req, {
      allowWithoutOrigin: hasBearerAuthorization(req) || !hasSessionAccessCookie(req),
    });

    if (!originValidation.ok) {
      return res.status(403).json({ error: originValidation.reason });
    }
  }

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
    return res.status(500).json({ error: "server_misconfigured" });
  }

  try {
    const accessToken = getAccessToken(req);

    if (!accessToken) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();

    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: usuario, error: usuarioErr } = await supabaseAdmin
      .from("usuario")
      .select("id")
      .eq("supabase_uid", userData.user.id)
      .maybeSingle();

    if (usuarioErr || !usuario?.id) {
      return res.status(401).json({ error: "unauthorized" });
    }

    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("direccion_usuario")
        .select("id, direccion, ciudad, pais, codigo_postal, tipo_direccion, fecha_creacion")
        .eq("usuario_id", usuario.id)
        .order("fecha_creacion", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return res.status(500).json({ error: "internal_error" });
      }

      return res.status(200).json({
        direccion: data
          ? {
              id: data.id,
              direccion: data.direccion,
              ciudad: data.ciudad,
              pais: data.pais,
              codigo_postal: data.codigo_postal ?? null,
              tipo_direccion: data.tipo_direccion ?? null,
              fecha_creacion: data.fecha_creacion,
            }
          : null,
      });
    }

    const payload = parsePayload(req.body);

    if (!payload) {
      return res.status(400).json({ error: "direccion_payload_invalido" });
    }

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("direccion_usuario")
      .select("id")
      .eq("usuario_id", usuario.id)
      .order("fecha_creacion", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      return res.status(500).json({ error: "internal_error" });
    }

    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from("direccion_usuario")
        .update(payload)
        .eq("id", existing.id)
        .select("id, direccion, ciudad, pais, codigo_postal, tipo_direccion, fecha_creacion")
        .single();

      if (error) {
        return res.status(500).json({ error: "internal_error" });
      }

      return res.status(200).json({ direccion: data });
    }

    const { data, error } = await supabaseAdmin
      .from("direccion_usuario")
      .insert({
        usuario_id: usuario.id,
        ...payload,
      })
      .select("id, direccion, ciudad, pais, codigo_postal, tipo_direccion, fecha_creacion")
      .single();

    if (error) {
      return res.status(500).json({ error: "internal_error" });
    }

    return res.status(200).json({ direccion: data });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
}
