import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function RegistroEmpresa() {
  const { sessionUser } = useAuth();
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  const handleRegistro = async () => {
    if (!sessionUser) return;
    setCargando(true);

    // Validar si el usuario ya está registrado
    const { data: usuarioExistente } = await supabase
      .from('usuario')
      .select('id')
      .eq('correo', sessionUser.email)
      .single();

    if (usuarioExistente) {
      alert('Este usuario ya está registrado.');
      setCargando(false);
      return;
    }

    // 1. Crear empresa
    const { data: empresa, error: errorEmpresa } = await supabase
      .from('empresa')
      .insert({ nombre: nombreEmpresa, descripcion })
      .select()
      .single();

    if (errorEmpresa || !empresa) {
      alert('Error creando la empresa');
      setCargando(false);
      return;
    }

    // 2. Registrar usuario como admin
    const { error: errorUsuario } = await supabase.from('usuario').insert({
      id: sessionUser.id,
      correo: sessionUser.email,
      nombre: sessionUser.user_metadata?.name || '',
      empresa_id: empresa.id,
      rol: 'admin',
    });

    if (errorUsuario) {
      console.error('Error insertando usuario:', errorUsuario.message);
      alert('Error registrando al usuario');
      setCargando(false);
      return;
    }

    // 3. Redirigir al home
    router.push('/');
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow">
      <h1 className="text-xl font-bold mb-4">Crear nueva empresa</h1>

      <label className="block mb-2">
        Nombre de la empresa:
        <input
          type="text"
          value={nombreEmpresa}
          onChange={(e) => setNombreEmpresa(e.target.value)}
          className="w-full border px-2 py-1 mt-1"
        />
      </label>

      <label className="block mb-4">
        Descripción:
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="w-full border px-2 py-1 mt-1"
        />
      </label>

      <button
        onClick={handleRegistro}
        disabled={cargando}
        className="bg-black text-white px-4 py-2 rounded mt-4"
      >
        {cargando ? 'Registrando...' : 'Crear empresa y continuar'}
      </button>
    </div>
  );
}
