import React from 'react';
import Link from 'next/link';
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
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <Link href="/" className="text-xl font-bold">
          RÆYZ
        </Link>

        <div className="w-full md:w-1/3">
          <SearchBar onSearch={handleSearch} placeholder="Buscar en la tienda..." />
        </div>
        
        <nav>
          <ul className="flex space-x-6">
            <li><Link href="/" className="hover:text-gray-300">Inicio</Link></li>
            <li><Link href="/coleccion" className="hover:text-gray-300">Colección</Link></li>
            <li><Link href="/nosotros" className="hover:text-gray-300">Nosotros</Link></li>
            <li><Link href="/contacto" className="hover:text-gray-300">Contacto</Link></li>
            <li className="ml-2">
              <CartButton itemCount={itemCount} />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;