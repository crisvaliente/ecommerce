import React from 'react';
import Link from 'next/link';

const Header: React.FC = () => {
  return (
    <header className="bg-black text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
        RÆYZ

        </Link>
        <nav>
          <ul className="flex space-x-6">
            <li><Link href="/" className="hover:text-gray-300">Inicio</Link></li>
            <li><Link href="/coleccion" className="hover:text-gray-300">Colección</Link></li>
            <li><Link href="/nosotros" className="hover:text-gray-300">Nosotros</Link></li>
            <li><Link href="/contacto" className="hover:text-gray-300">Contacto</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;