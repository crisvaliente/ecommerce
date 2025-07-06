import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export const useGoogleLoginHandler = () => {
  const router = useRouter();

  const handleGoogleLoginRedirect = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      router.push('/auth/login');
      return;
    }

    const { data } = await supabase
      .from('usuario')
      .select('*')
      .eq('correo', user.email)
      .single();

    if (data) {
      router.push('/');
    } else {
      router.push('/auth/registroempresa');
    }
  };

  return { handleGoogleLoginRedirect };
};
