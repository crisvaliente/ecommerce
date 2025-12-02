// src/pages/_app.tsx
import type { AppProps } from "next/app";
import { useRouter } from "next/router";

import Header from "../components/common/Header";
import Footer from "../components/common/Footer";
import { CartProvider } from "../components/ui/CartContext";
import { AuthProvider } from "../context/AuthContext";
import "../styles/globals.css";

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isPanelRoute = router.pathname.startsWith("/panel");

  return (
    <AuthProvider>
      <CartProvider>
        {isPanelRoute ? (
          // 🌑 Mundo PANEL (sin header/footer públicos)
          <main className="min-h-screen">
            <Component {...pageProps} />
          </main>
        ) : (
          // 🌕 Mundo PÚBLICO (con header + footer)
          <>
            <Header />
            <main className="min-h-screen">
              <Component {...pageProps} />
            </main>
            <Footer />
          </>
        )}
      </CartProvider>
    </AuthProvider>
  );
}

export default MyApp;
