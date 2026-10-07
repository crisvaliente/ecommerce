import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import { decidePanelAdmission } from "../../lib/panelRouteCapabilities";

type PanelRouteGateProps = { children: React.ReactNode };

export default function PanelRouteGate({ children }: PanelRouteGateProps) {
  const router = useRouter();
  const { loading, sessionUser, dbUser, profileStatus, refresh } = useAuth();
  const admission = decidePanelAdmission({
    loading,
    pathname: router.pathname,
    sessionUser,
    dbUser,
    profileStatus,
  });
  const redirectDestination = admission.kind === "redirect" ? admission.destination : null;

  useEffect(() => {
    if (redirectDestination) router.replace(redirectDestination);
  }, [redirectDestination, router]);

  if (admission.kind === "profile-error") {
    return (
      <div className="px-8 py-6" role="alert">
        <p className="text-sm text-slate-700">
          No pudimos cargar tu perfil. Revisá tu conexión e intentá de nuevo.
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-3 text-sm font-medium text-slate-900 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (admission.kind !== "allow") {
    return (
      <div className="px-8 py-6" role="status">
        <p className="text-sm text-slate-500">Verificando acceso…</p>
      </div>
    );
  }

  return <>{children}</>;
}
