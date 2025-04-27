// components/ui/NavLink.tsx
import { tv } from 'tailwind-variants';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';

const navLink = tv({
  base: 'hover:text-gray-300 transition-colors duration-200',
  variants: {
    active: {
      true: 'underline underline-offset-4 text-gray-300', // Estilos extra para activo
      false: '',
    },
  },
});

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ href, children }) => {
  const router = useRouter();
  
  // Detectamos si el href es igual a la ruta actual
  const isActive = router.pathname === href;

  return (
    <Link href={href} className={navLink({ active: isActive })}>
      {children}
    </Link>
  );
};

export default NavLink;
