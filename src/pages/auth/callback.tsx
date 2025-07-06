import { useEffect } from 'react';
import { useGoogleLoginHandler } from '../../services/authService';

export default function Callback() {
  const { handleGoogleLoginRedirect } = useGoogleLoginHandler();

  useEffect(() => {
    handleGoogleLoginRedirect();
  }, [handleGoogleLoginRedirect]);

  return <p className="text-center mt-10">Cargando...</p>;
}
