// src/pages/_app.tsx
import type { AppProps } from 'next/app';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import { CartProvider } from '../components/ui/CartContext';
import { AuthProvider } from '../context/AuthContext';
import '../styles/globals.css';


function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <CartProvider>
        <Header />
        <main className="min-h-screen">
          <Component {...pageProps} />
        </main>
        <Footer />
      </CartProvider>
    </AuthProvider>
  );
}


export default MyApp;
