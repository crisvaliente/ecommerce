import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import NavLink from '../ui/NavLink';
import SearchBar from './SearchBar';
import { useRouter } from 'next/router';
import CartButton from '../ui/CartButton';
import { useCart } from '../ui/CartContext';
import LoginMenu from './LoginMenu';
import { useAuth } from '../../context/AuthContext';
import Image from 'next/image';

const Header: React.FC = () => {
  const router = useRouter();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { sessionUser, dbUser, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  const handleSearch = (query: string) => {
    if (query.trim()) {
      router.push(`/busqueda?q=${encodeURIComponent(query)}`);
    }
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const toggleUserMenu = () => {
    setUserMenuOpen(!userMenuOpen);
  };

  // Cerrar menú usuario al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-background text-foreground p-4 font-raleway">
      <div className="container mx-auto flex flex-wrap items-center justify-between">

        {/* Logo */}
        <div className="flex-shrink-0 bg-background p-1 rounded">
          <Link href="/">
            <Image
              src="/images/logo.PNG"
              alt="Logo RÆYZ"
              width={40}
              height={40}
              className="h-10 w-auto"
            />
          </Link>
        </div>

        {/* Botón hamburguesa (mobile) */}
        <button
          className="block md:hidden text-white focus:outline-none"
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
            {menuOpen ? (
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M18.364 5.636a1 1 0 00-1.414-1.414L12 9.172 7.05 4.222a1 1 0 10-1.414 1.414L10.828 12l-5.192 5.192a1 1 0 101.414 1.414L12 14.828l4.95 4.95a1 1 0 001.414-1.414L13.172 12l5.192-5.192z"
              />
            ) : (
              <path
                fillRule="evenodd"
                d="M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h16v2H4v-2z"
              />
            )}
          </svg>
        </button>

        {/* NAV principal */}
        <nav
          className={`w-full md:flex md:items-center md:w-auto ${
            menuOpen ? 'block' : 'hidden'
          } md:block`}
        >
          <ul className="flex flex-col md:flex-row md:justify-center md:space-x-8 text-lg">
            {/* Links públicos */}
            <li>
              <NavLink href="/">Inicio</NavLink>
            </li>
            <li>
              <NavLink href="/coleccion">Colección</NavLink>
            </li>
            <li>
              <NavLink href="/nosotros">Nosotros</NavLink>
            </li>
            <li>
              <NavLink href="/contacto">Contacto</NavLink>
            </li>

            {/* Acceso al panel solo para admin/dueña */}
            {(dbUser?.rol === 'admin' || dbUser?.rol === 'dueña') && (
              <li>
                <NavLink href="/panel">Panel</NavLink>
              </li>
            )}

            {/* Extra para usuarios logueados con rol "usuario" */}
            {dbUser?.rol === 'usuario' && (
              <>
                <li>
                  <NavLink href="/coleccion">Catálogo</NavLink>
                </li>
                <li>
                  <NavLink href="/mis-ordenes">Mis Órdenes</NavLink>
                </li>
                <li>
                  <NavLink href="/mi-cuenta">Mi Cuenta</NavLink>
                </li>
              </>
            )}
          </ul>
        </nav>

        {/* Search + User + Cart */}
        <div className="flex items-center gap-4 flex-shrink-0 mt-4 md:mt-0 w-full md:w-auto">
          <SearchBar onSearch={handleSearch} placeholder="Buscar..." />

          {sessionUser ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={toggleUserMenu}
                className="flex items-center space-x-2 text-white hover:underline focus:outline-none"
                aria-haspopup="true"
                aria-expanded={userMenuOpen}
              >
                <span>{dbUser?.nombre || sessionUser.email}</span>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${
                    userMenuOpen ? 'transform rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 text-gray-800">
                  <Link
                    href="/mis-ordenes"
                    className="block px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    Mis órdenes
                  </Link>
                  <Link
                    href="/mi-cuenta"
                    className="block px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    Mi cuenta
                  </Link>
                  <Link
                    href="/mi-billetera"
                    className="block px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    Mi Billetera
                  </Link>
                  <Link
                    href="/rastrear-pedido"
                    className="block px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    Rastrear pedido
                  </Link>
                  <Link
                    href="/sorteo-mensual"
                    className="block px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    Sorteo mensual
                  </Link>
                  <Link
                    href="/devoluciones"
                    className="block px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    Devoluciones
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    Salir
                  </button>
                </div>
              )}
            </div>
          ) : (
            <LoginMenu />
          )}

          <CartButton itemCount={itemCount} />
        </div>
      </div>
    </header>
  );
};

export default Header;
