import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type TestResult = {
  name: string;
  status: "ok" | "fail" | "warn";
  message: string;
  time: number;
};

export default function DebugDeployPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const runTests = async () => {
      const newResults: TestResult[] = [];

      const test = async (
        name: string,
        callback: () => Promise<TestResult>
      ) => {
        const start = performance.now();
        const result = await callback();
        const end = performance.now();
        newResults.push({ ...result, time: Math.round(end - start) });
      };

      // 🔹 1. Test de conexión Supabase (sin 'data' para evitar no-unused-vars)
      await test("Conexión a Supabase", async () => {
        try {
          const { error } = await supabase.from("usuario").select("id").limit(1);
          if (error) throw error;
          return {
            name: "Conexión a Supabase",
            status: "ok",
            message: "Conexión exitosa con la base de datos",
            time: 0,
          };
        } catch {
          return {
            name: "Conexión a Supabase",
            status: "fail",
            message: "Error al conectar con Supabase",
            time: 0,
          };
        }
      });

      // 🔹 2. Test de sesión activa
      await test("Sesión activa", async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        return session
          ? {
              name: "Sesión activa",
              status: "ok",
              message: `Usuario: ${session.user.email}`,
              time: 0,
            }
          : {
              name: "Sesión activa",
              status: "warn",
              message: "No hay sesión iniciada",
              time: 0,
            };
      });

      // 🔹 3. Test de usuario en tabla
      await test("Usuario en tabla", async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          return {
            name: "Usuario en tabla",
            status: "warn",
            message: "No hay sesión para verificar usuario",
            time: 0,
          };
        }

        const { data, error } = await supabase
          .from("usuario")
          .select("*")
          .eq("supabase_uid", session.user.id)
          .single();

        return !error && data
          ? {
              name: "Usuario en tabla",
              status: "ok",
              message: "Usuario encontrado correctamente",
              time: 0,
            }
          : {
              name: "Usuario en tabla",
              status: "fail",
              message: "No se encontró el registro del usuario",
              time: 0,
            };
      });

      // 🔹 4. Test de variables de entorno
      await test("Variables de entorno", async () => {
        const envOK =
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        return envOK
          ? {
              name: "Variables de entorno",
              status: "ok",
              message: "Claves detectadas correctamente",
              time: 0,
            }
          : {
              name: "Variables de entorno",
              status: "fail",
              message:
                "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY",
              time: 0,
            };
      });

      setResults(newResults);
      setLoading(false);
    };

    void runTests();
  }, []);

  // 🟢🟡🔴 colores
  const getColor = (status: string) =>
    status === "ok"
      ? "text-green-500"
      : status === "fail"
      ? "text-red-500"
      : "text-yellow-500";

  // 📤 Export JSON
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "debug-deploy-log.json";
    a.click();
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono p-6">
      <h1 className="text-xl mb-4 text-blue-400">🔧 Debug Deploy Panel (Extendido)</h1>
      {loading ? (
        <p className="text-gray-400">Ejecutando pruebas...</p>
      ) : (
        <>
          <ul className="space-y-3 mb-6">
            {results.map((r) => (
              <li key={r.name} className="border-b border-gray-700 pb-2">
                <span className={getColor(r.status)}>●</span>{" "}
                <strong>{r.name}</strong> → {r.message}{" "}
                <span className="text-gray-500 text-sm">
                  ({r.time} ms)
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleExport}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Exportar JSON
          </button>
        </>
      )}
    </div>
  );
}
