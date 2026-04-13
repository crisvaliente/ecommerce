import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

type DireccionResponse = {
  id: string;
  direccion: string;
  ciudad: string;
  pais: string;
  codigo_postal: string | null;
  tipo_direccion: string | null;
  fecha_creacion: string;
};

type FormState = {
  direccion: string;
  ciudad: string;
  pais: string;
  codigo_postal: string;
  tipo_direccion: "hogar" | "trabajo" | "otro";
};

const EMPTY_FORM: FormState = {
  direccion: "",
  ciudad: "",
  pais: "Uruguay",
  codigo_postal: "",
  tipo_direccion: "hogar",
};

function mapDireccionToForm(direccion: DireccionResponse | null): FormState {
  if (!direccion) return EMPTY_FORM;

  return {
    direccion: direccion.direccion,
    ciudad: direccion.ciudad,
    pais: direccion.pais,
    codigo_postal: direccion.codigo_postal ?? "",
    tipo_direccion:
      direccion.tipo_direccion === "trabajo" || direccion.tipo_direccion === "otro"
        ? direccion.tipo_direccion
        : "hogar",
  };
}

export default function MiCuentaPage() {
  const router = useRouter();
  const { sessionUser, dbUser, loading } = useAuth();

  const [direccion, setDireccion] = useState<DireccionResponse | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loadingDireccion, setLoadingDireccion] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!sessionUser) {
      router.replace("/auth/login");
    }
  }, [loading, router, sessionUser]);

  useEffect(() => {
    let cancelled = false;

    const loadDireccion = async () => {
      if (!sessionUser) return;

      try {
        setLoadingDireccion(true);
        setErrorMsg(null);
        setSuccessMsg(null);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const accessToken = session?.access_token ?? null;

        if (!accessToken) {
          if (!cancelled) setErrorMsg("No pudimos validar tu sesión.");
          return;
        }

        const response = await fetch("/api/ecommerce/mi-cuenta/direccion", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const body = (await response.json().catch(() => null)) as
          | { direccion?: DireccionResponse | null; error?: string }
          | null;

        if (!response.ok) {
          if (!cancelled) {
            setErrorMsg("No pudimos cargar tu dirección.");
          }
          return;
        }

        const current = body?.direccion ?? null;

        if (!cancelled) {
          setDireccion(current);
          setForm(mapDireccionToForm(current));
        }
      } catch {
        if (!cancelled) setErrorMsg("No pudimos cargar tu dirección.");
      } finally {
        if (!cancelled) setLoadingDireccion(false);
      }
    };

    loadDireccion();

    return () => {
      cancelled = true;
    };
  }, [sessionUser]);

  const hasDireccion = Boolean(direccion);

  const handleChange =
    (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const canSave = useMemo(() => {
    return Boolean(form.direccion.trim() && form.ciudad.trim() && form.pais.trim());
  }, [form.ciudad, form.direccion, form.pais]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSave) {
      setErrorMsg("Completá dirección, ciudad y país para continuar.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token ?? null;

      if (!accessToken) {
        setErrorMsg("No pudimos validar tu sesión.");
        return;
      }

      const response = await fetch("/api/ecommerce/mi-cuenta/direccion", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(form),
      });

      const body = (await response.json().catch(() => null)) as
        | { direccion?: DireccionResponse | null; error?: string }
        | null;

      if (!response.ok || !body?.direccion) {
        setErrorMsg("No pudimos guardar tu dirección. Probá nuevamente.");
        return;
      }

      setDireccion(body.direccion);
      setForm(mapDireccionToForm(body.direccion));
      setSuccessMsg("Tu dirección quedó guardada y ya podés continuar con la compra.");
    } catch {
      setErrorMsg("No pudimos guardar tu dirección. Probá nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !sessionUser) {
    return <main className="min-h-screen bg-stone-100 px-4 py-10 text-stone-900" />;
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-10 text-stone-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Mi cuenta</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Tu perfil y dirección</h1>
          <p className="mt-2 text-sm text-stone-600">
            Desde acá podés guardar la dirección que vamos a usar para tus próximas compras.
          </p>
        </section>

        <Card className="p-5">
          <h2 className="text-lg font-medium text-text">Resumen de cuenta</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Nombre</p>
              <p className="mt-1 text-sm text-text">{dbUser?.nombre ?? sessionUser.email ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Correo</p>
              <p className="mt-1 text-sm text-text">{dbUser?.correo ?? sessionUser.email ?? "-"}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-text">Dirección</h2>
              <p className="mt-1 text-sm text-muted">
                {hasDireccion
                  ? "Tu dirección actual se va a usar para armar el pedido y el snapshot de envío."
                  : "Necesitás una dirección guardada para poder comprar."}
              </p>
            </div>

            <Link
              href="/coleccion"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-50"
            >
              Volver a colección
            </Link>
          </div>

          {loadingDireccion ? (
            <p className="mt-4 text-sm text-muted">Cargando dirección...</p>
          ) : (
            <>
              {errorMsg && (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  {errorMsg}
                </p>
              )}

              {successMsg && (
                <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  {successMsg}
                </p>
              )}

              {hasDireccion && (
                <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-900">
                  <p className="font-medium">Dirección actual</p>
                  <p className="mt-2">
                    {direccion?.direccion}, {direccion?.ciudad}, {direccion?.pais}
                    {direccion?.codigo_postal ? `, ${direccion.codigo_postal}` : ""}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-stone-500">
                    Tipo: {direccion?.tipo_direccion ?? "hogar"}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-muted">Dirección</span>
                    <input
                      value={form.direccion}
                      onChange={handleChange("direccion")}
                      className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-500"
                      placeholder="Calle y número"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-muted">Ciudad</span>
                    <input
                      value={form.ciudad}
                      onChange={handleChange("ciudad")}
                      className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-500"
                      placeholder="Montevideo"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-muted">País</span>
                    <input
                      value={form.pais}
                      onChange={handleChange("pais")}
                      className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-500"
                      placeholder="Uruguay"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-muted">Código postal</span>
                    <input
                      value={form.codigo_postal}
                      onChange={handleChange("codigo_postal")}
                      className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-500"
                      placeholder="11000"
                    />
                  </label>
                </div>

                <label className="block max-w-xs">
                  <span className="text-xs uppercase tracking-wide text-muted">Tipo de dirección</span>
                  <select
                    value={form.tipo_direccion}
                    onChange={handleChange("tipo_direccion")}
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-500"
                  >
                    <option value="hogar">Hogar</option>
                    <option value="trabajo">Trabajo</option>
                    <option value="otro">Otro</option>
                  </select>
                </label>

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={saving || !canSave}>
                    {saving ? "Guardando..." : hasDireccion ? "Actualizar dirección" : "Guardar dirección"}
                  </Button>
                  <Link
                    href="/coleccion"
                    className="rounded-md border border-dark/12 bg-dark px-4 py-2 text-sm font-medium tracking-[0.01em] text-text-inverse transition hover:bg-black"
                  >
                    Seguir comprando
                  </Link>
                </div>
              </form>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
