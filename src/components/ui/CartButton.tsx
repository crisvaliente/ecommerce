import React, { useState } from 'react';
import { FaShoppingCart } from 'react-icons/fa';
import ShoppingCart from './ShoppingCart';

interface CartButtonProps {
  itemCount?: number;
}

const CartButton: React.FC<CartButtonProps> = ({ itemCount = 0 }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsCartOpen(true)}
        className="relative p-2 text-gray-700 hover:text-blue-600"
        aria-label="Shopping cart"
      >
        <FaShoppingCart size={24} />
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </button>
      
      <ShoppingCart 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
      />
    </>
  );
};

export default CartButton;