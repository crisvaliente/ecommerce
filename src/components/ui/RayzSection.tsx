// src/components/ui/RayzSection.tsx (versión avanzada)
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { instanceConfig } from '../../config/instance';

interface RayzSectionProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonLink?: string;
  backgroundImage?: string;
}

const RayzSection: React.FC<RayzSectionProps> = ({
  title = `Bienvenidx a ${instanceConfig.store.name}`,
  subtitle = instanceConfig.store.description ?? "",
  buttonText = "Ver colección",
  buttonLink = "/coleccion",
  backgroundImage = instanceConfig.store.assets.hero
}) => {
  return (
    <section className="relative h-[80vh] flex items-center justify-center text-white bg-black overflow-hidden">
      <Image
        src={backgroundImage}
        alt={`Presentación de ${instanceConfig.store.name}`}
        fill
        className="object-contain object-center opacity-100"
        priority
      />
      
      <div className="relative z-10 text-center px-4 max-w-4xl">
        <h1 className="text-4xl md:text-6xl font-bold mb-4 font-raleway">{title}</h1>
        <p className="text-lg md:text-xl mb-6">{subtitle}</p>
        <Link href={buttonLink}>
          <button className="bg-white text-black px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition">
            {buttonText}
          </button>
        </Link>
      </div>
    </section>
  );
};

export default RayzSection;