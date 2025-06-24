import React, { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  rolesPermitidos?: string[]; // opcional, para controlar por rol
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, rolesPermitidos }) => {
  const { sessionUser, dbUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!sessionUser) {
        router.replace('/auth/login');
      } else if (!dbUser) {
        router.replace('/auth/no-autorizado');
      } else if (rolesPermitidos && !rolesPermitidos.includes(dbUser.rol)) {
        router.replace('/auth/no-autorizado');
      }
    }
  }, [sessionUser, dbUser, loading, router, rolesPermitidos]);

  if (loading || !sessionUser || !dbUser) {
    return <p className="text-center mt-10">Cargando...</p>;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

