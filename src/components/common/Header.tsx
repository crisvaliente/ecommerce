import React from 'react';
import Link from 'next/link';
import NavLink from '../ui/NavLink'; // Importamos el NavLink
import SearchBar from './SearchBar';
import { useRouter } from 'next/router';
import CartButton from '../ui/CartButton';
import { useCart } from '../ui/CartContext';

const Header: React.FC = () => {
  const router = useRouter();
  const { itemCount } = useCart();

  const handleSearch = (query: string) => {
    if (query.trim()) {
      router.push(`/busqueda?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <header className="bg-black text-white p-4">
      <div className="container mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex-shrink-0">
          <Link href="/" className="text-2xl font-bold">
            RÆYZ
          </Link>
        </div>

        {/* Menú con NavLink */}
        <nav className="flex-1">
          <ul className="flex justify-center space-x-8 text-lg">
            <li><NavLink href="/" >Inicio</NavLink></li>
            <li><NavLink href="/coleccion" >Colección</NavLink></li>
            <li><NavLink href="/nosotros" >Nosotros</NavLink></li>
            <li><NavLink href="/contacto" >Contacto</NavLink></li>
          </ul>
        </nav>

        {/* Search + Cart */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <SearchBar onSearch={handleSearch} placeholder="Buscar..." />
          <CartButton itemCount={itemCount} />
        </div>
      </div>
    </header>
  );
};

export default Header;
