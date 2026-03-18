'use client'

import React from 'react'
import Card from '../components/ui/Card'

const NosotrosPage: React.FC = () => {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <Card className="mx-auto max-w-3xl p-8 md:p-10">
        <h1 className="font-raleway text-3xl font-bold text-text">Nosotros</h1>
        <div className="mt-6 space-y-4 text-base leading-7 text-muted md:text-lg">
          <p>
            Bienvenido a nuestra tienda de ropa, donde la moda y la calidad se unen para ofrecerte las mejores prendas.
          </p>
          <p>
            Somos una marca comprometida con el estilo, la comodidad y la satisfacción de nuestros clientes. Nuestro equipo trabaja con pasión para seleccionar y diseñar ropa que refleje las últimas tendencias y se adapte a tu personalidad.
          </p>
          <p>
            Gracias por confiar en nosotros y ser parte de esta comunidad de amantes de la moda.
          </p>
        </div>
      </Card>
    </main>
  )
}

export default NosotrosPage
