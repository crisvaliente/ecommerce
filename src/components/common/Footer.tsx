import React from 'react';
import Link from 'next/link';

const Footer: React.FC = () => {
  return (
    <footer className="bg-background text-foreground p-8">
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 className="text-xl font-bold mb-4 text-primary">
            <img src="/images/logo.PNG" alt="Logo RÆYZ" className="h-10 w-auto" />
          </h3>
          <p>Handmade & único como vos.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Enlaces</h4>
          <ul className="space-y-2">
            <li><Link href="/" className="hover:text-primary">Inicio</Link></li>
            <li><Link href="/coleccion" className="hover:text-primary">Colección</Link></li>
            <li><Link href="/nosotros" className="hover:text-primary">Nosotros</Link></li>
            <li><Link href="/contacto" className="hover:text-primary">Contacto</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Contacto</h4>
          <p>Email: info@rayz.com</p>
          <p>Teléfono: +123 456 7890</p>
          <div className="flex space-x-4 mt-4">
            {/* Íconos de redes sociales aquí */} 
            <a href="#" className="hover:text-primary">Instagram</a>
            <a href="#" className="hover:text-primary">Facebook</a>
          </div>
        </div>
      </div>
      <div className="border-t border-primary mt-8 pt-8 text-center">
        <p>&copy; {new Date().getFullYear()} RÆYZ. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
};

export default Footer;