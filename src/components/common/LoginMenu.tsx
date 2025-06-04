import React from 'react';
import Link from 'next/link';

const LoginMenu: React.FC = () => {
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
