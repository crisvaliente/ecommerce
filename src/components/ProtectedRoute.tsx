import React, { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace('/auth/login');
    }
  }, [user, router]);

  if (!user) {
    return null; // or a loading spinner
  }

  return <>{children}</>;
};

export default ProtectedRoute;
