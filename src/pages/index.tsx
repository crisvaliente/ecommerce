// src/pages/index.tsx
import React from 'react';
import RayzSection from '../components/ui/RayzSection';

const Home: React.FC = () => {
  return (
    <>
      {/* El RayzSection va aquí, como primer elemento */}
      <RayzSection />
      
      {/* Después vendrían las demás secciones de tu página de inicio */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold mb-10 text-center">Productos Destacados</h2>
          {/* Contenido de productos destacados... */}
        </div>
      </section>
      
      {/* Otras secciones... */}
    </>
  );
};

export default Home;