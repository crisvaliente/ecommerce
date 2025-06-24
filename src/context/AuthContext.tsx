// 👇 Importaciones iguales a las tuyas
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { supabase } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/router';

interface CustomUser {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  empresa_id: string;
}

interface AuthContextType {
  sessionUser: User | null;
  dbUser: CustomUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getUserData = async () => {
      setLoading(true);

      const { data: authData } = await supabase.auth.getSession();
      const user = authData.session?.user ?? null;
      setSessionUser(user);

      if (user) {
        const email = user.email?.toLowerCase();
        console.log('Buscando usuario con correo:', email);

        const { data, error } = await supabase
          .from('usuario')
          .select('*')
          .eq('correo', email)
          .single();

        if (data) {
          console.log('Usuario encontrado:', data);
          setDbUser(data);
        } else {
          console.warn('Usuario no encontrado en BD o error:', error);
          setDbUser(null);

          // Si NO estamos en las páginas permitidas, redirigimos a registro
          if (
            router.pathname !== '/auth/registroempresa' &&
            router.pathname !== '/auth/no-autorizado'
          ) {
            router.push('/auth/registroempresa'); // <-- Redirige a crear empresa
          }
        }
      } else {
        setDbUser(null);
      }

      setLoading(false);
    };

    getUserData();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSessionUser(session?.user ?? null);
        getUserData();
      }
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSessionUser(null);
    setDbUser(null);
  };

  return (
    <AuthContext.Provider value={{ sessionUser, dbUser, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};



