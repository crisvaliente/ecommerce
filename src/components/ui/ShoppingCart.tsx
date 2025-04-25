import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { FaShoppingCart, FaTrash, FaPlus, FaMinus } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

// Tipos para nuestro carrito
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface ShoppingCartProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShoppingCart: React.FC<ShoppingCartProps> = ({ isOpen, onClose }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Simulamos cargar productos del carrito (en producción usarías un context o redux)
  useEffect(() => {
    const loadCartFromLocalStorage = () => {
      setIsLoading(true);
      try {
        const savedCart = localStorage.getItem('shoppingCart');
        if (savedCart) {
          setCartItems(JSON.parse(savedCart));
        }
      } catch (error) {
        console.error('Error loading cart:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      loadCartFromLocalStorage();
    }
  }, [isOpen]);

  // Guardar carrito en localStorage cuando cambia
  useEffect(() => {
    if (cartItems.length > 0) {
      localStorage.setItem('shoppingCart', JSON.stringify(cartItems));
    }
  }, [cartItems]);

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    setCartItems(prevItems => 
      prevItems.map(item => 
        item.id === id ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const removeFromCart = (id: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleCheckout = () => {
    // Aquí iría la lógica para redirigir al checkout
    console.log("Proceeding to checkout...");
    // router.push('/checkout');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />
          
          {/* Cart Sidebar */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween' }}
            className="fixed right-0 top-0 h-full w-80 md:w-96 bg-white z-50 shadow-lg"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-xl font-semibold flex items-center">
                  <FaShoppingCart className="mr-2" />
                  Your Cart
                </h2>
                <button 
                  onClick={onClose}
                  className="p-1 rounded-full hover:bg-gray-200"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>
              
              {/* Body - Cart Items */}
              <div className="flex-grow overflow-auto p-4">
                {isLoading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : cartItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                    <FaShoppingCart size={40} className="mb-2" />
                    <p>Your cart is empty</p>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {cartItems.map(item => (
                      <li key={item.id} className="flex border-b pb-4">
                        <div className="w-20 h-20 relative mr-4">
                          <Image 
                            src={item.image} 
                            alt={item.name}
                            layout="fill"
                            objectFit="cover"
                            className="rounded-md"
                          />
                        </div>
                        <div className="flex-grow">
                          <h3 className="font-medium">{item.name}</h3>
                          <p className="text-gray-600">${item.price.toFixed(2)}</p>
                          <div className="flex items-center mt-2">
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="p-1 rounded-full hover:bg-gray-200"
                            >
                              <FaMinus size={12} />
                            </button>
                            <span className="mx-2">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="p-1 rounded-full hover:bg-gray-200"
                            >
                              <FaPlus size={12} />
                            </button>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-500 p-1 hover:bg-red-50 rounded-full"
                        >
                          <FaTrash />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              {/* Footer - Totals and Checkout */}
              <div className="p-4 border-t mt-auto">
                <div className="flex justify-between text-lg font-semibold mb-4">
                  <span>Total:</span>
                  <span>${calculateTotal().toFixed(2)}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={cartItems.length === 0}
                  className={`w-full py-2 px-4 rounded-md ${
                    cartItems.length === 0 
                      ? 'bg-gray-300 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  Proceed to Checkout
                </button>
                <button
                  onClick={onClose}
                  className="w-full mt-2 py-2 px-4 rounded-md border border-gray-300 hover:bg-gray-100"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ShoppingCart;