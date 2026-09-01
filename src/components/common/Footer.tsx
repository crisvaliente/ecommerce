import React from "react";
import Link from "next/link";
import Image from "next/image";
import { instanceConfig } from "../../config/instance";

const Footer: React.FC = () => {
  const { name, description, assets } = instanceConfig.store;

  return (
    <footer className="bg-background p-8 text-foreground">
      <div className="container mx-auto grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h3 className="mb-4 text-xl font-bold text-primary">
            <Image
              src={assets.logo}
              alt={`Logo ${name}`}
              width={40}
              height={40}
              className="h-10 w-auto"
            />
          </h3>
          {description && <p>{description}</p>}
        </div>
        <div>
          <h4 className="mb-4 font-semibold">Enlaces</h4>
          <ul className="space-y-2">
            <li><Link href="/" className="hover:text-primary">Inicio</Link></li>
            <li><Link href="/coleccion" className="hover:text-primary">Colección</Link></li>
            <li><Link href="/nosotros" className="hover:text-primary">Nosotros</Link></li>
            <li><Link href="/contacto" className="hover:text-primary">Contacto</Link></li>
          </ul>
        </div>
      </div>
      <div className="mt-8 border-t border-primary pt-8 text-center">
        <p>&copy; {new Date().getFullYear()} {name}. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
};

export default Footer;
