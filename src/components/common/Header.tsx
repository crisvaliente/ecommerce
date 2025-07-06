import React, { useState } from 'react';
import Link from 'next/link';
import NavLink from '../ui/NavLink'; // Importamos el NavLink
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

  const { sessionUser, signOut } = useAuth();

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

  return (
    <header className="bg-background text-foreground p-4 font-raleway">
      <div className="container mx-auto flex flex-wrap items-center justify-between">
        {/* Logo */}
        <div className="flex-shrink-0 bg-background p-1 rounded">
          <Link href="/">
            <Image src="/images/logo.PNG" alt="Logo RÆYZ" width={40} height={40} className="h-10 w-auto" />
          </Link>
        </div>

        {/* Hamburger menu button for small screens */}
        <button
          className="block md:hidden text-white focus:outline-none"
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <svg
            className="h-6 w-6 fill-current"
            viewBox="0 0 24 24"
          >
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

        {/* Menú con NavLink */}
        <nav className={`w-full md:flex md:items-center md:w-auto ${menuOpen ? 'block' : 'hidden'} md:block`}>
          <ul className="flex flex-col md:flex-row md:justify-center md:space-x-8 text-lg">
            <li><NavLink href="/" >Inicio</NavLink></li>
            <li><NavLink href="/coleccion" >Colección</NavLink></li>
            <li><NavLink href="/nosotros" >Nosotros</NavLink></li>
            <li><NavLink href="/contacto" >Contacto</NavLink></li>
          </ul>
        </nav>

          {/* Search + Cart */}
          <div className="flex items-center gap-4 flex-shrink-0 mt-4 md:mt-0 w-full md:w-auto">
            <SearchBar onSearch={handleSearch} placeholder="Buscar..." />
            {sessionUser ? (
              <div className="flex items-center space-x-4 text-white">
                <span>Hola, {sessionUser.email}</span>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 px-3 py-1 rounded hover:bg-red-700"
                >
                  Cerrar sesión
                </button>
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
