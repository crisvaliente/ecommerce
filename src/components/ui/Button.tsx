import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

const Button: React.FC<ButtonProps> = ({ variant = 'primary', className = '', ...props }) => {
  const baseClasses = 'px-4 py-2 rounded font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variantClasses = variant === 'primary'
    ? 'bg-primary text-white hover:bg-red-700 focus:ring-primary'
    : 'bg-foreground text-background hover:bg-gray-700 focus:ring-foreground';

  return (
    <button className={`${baseClasses} ${variantClasses} ${className}`} {...props} />
  );
};

export default Button;
