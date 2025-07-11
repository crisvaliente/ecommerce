import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';

const LoginMenu: React.FC = () => {
  const { sessionUser, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (sessionUser) {
    return (
      <button
        onClick={handleLogout}
        className="text-white hover:underline bg-red-600 px-3 py-1 rounded"
      >
        Cerrar sesión
      </button>
    );
  }

  return (
    <div className="flex space-x-4">
      <Link href="/auth/login" className="text-white hover:underline">
        Iniciar sesión
      </Link>
      <Link href="/auth/register" className="text-white hover:underline">
        Registrarse
      </Link>
    </div>
  );
};

export default LoginMenu;
