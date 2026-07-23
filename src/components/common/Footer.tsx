import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { STOREFRONT_CONFIG } from '../../config/storefront';

const Footer: React.FC = () => {
  const { contactEmail, contactPhone, instagramUrl, facebookUrl, tagline, name } =
    STOREFRONT_CONFIG;
  const hasSocialLinks = Boolean(instagramUrl || facebookUrl);

  return (
    <footer className="bg-background text-foreground p-8">
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 className="text-xl font-bold mb-4 text-primary">
            <Image src="/images/logo.PNG" alt={`Logo ${name}`} width={40} height={40} className="h-10 w-auto" />
          </h3>
          {tagline && <p>{tagline}</p>}
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
          {contactEmail && <p>Email: {contactEmail}</p>}
          {contactPhone && <p>Teléfono: <a href={`tel:${contactPhone}`} className="hover:text-primary">{contactPhone}</a></p>}
          {hasSocialLinks && (
            <div className="flex flex-wrap space-x-4 mt-4">
              {instagramUrl && (
                <a href={instagramUrl} className="hover:text-primary">Instagram</a>
              )}
              {facebookUrl && (
                <a href={facebookUrl} className="hover:text-primary">Facebook</a>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-primary mt-8 pt-8 text-center">
        <p>&copy; {new Date().getFullYear()} {name}. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
};

export default Footer;
