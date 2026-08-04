import React from 'react';
import Image from 'next/image';
import { FaShoppingCart, FaTrash, FaPlus, FaMinus } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { getCartIdentityKey, useCart } from './CartContext';

interface ShoppingCartProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShoppingCart: React.FC<ShoppingCartProps> = ({ isOpen, onClose }) => {
  const { items, incrementItem, decrementItem, removeItem, total } = useCart();

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
            className="fixed right-0 top-0 h-full w-80 md:w-96 bg-white z-50 shadow-xl rounded-l-2xl"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-xl font-semibold flex items-center text-gray-800">
                  <FaShoppingCart className="mr-2" />
                  Your Cart
                </h2>
                <button
                  onClick={onClose}
                  className="p-1 rounded-full hover:bg-gray-200"
                  aria-label="Close cart"
                >
                  <span className="text-2xl text-gray-600">&times;</span>
                </button>
              </div>

              {/* Body - Cart Items */}
              <div className="flex-grow overflow-auto p-4 space-y-4">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                    <FaShoppingCart size={40} className="mb-2" />
                    <p>Your cart is empty</p>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {items.map((item) => (
                      <li
                        key={getCartIdentityKey(item)}
                        className="flex border-b pb-4"
                      >
                        <div className="w-20 h-20 relative mr-4">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            sizes="80px"
                            className="rounded-md shadow-sm object-cover"
                          />
                        </div>
                        <div className="flex-grow">
                          <h3 className="font-medium text-gray-800">{item.name}</h3>
                          <p className="text-gray-600">${item.price.toFixed(2)}</p>
                          <div className="flex items-center mt-2">
                            <button
                              onClick={() =>
                                decrementItem(item.productoId, item.varianteId)
                              }
                              className="p-1 rounded-full bg-gray-200 hover:bg-gray-300 transition"
                              aria-label={`Decrease ${item.name} quantity`}
                            >
                              <FaMinus size={12} />
                            </button>
                            <span className="mx-2">{item.quantity}</span>
                            <button
                              onClick={() =>
                                incrementItem(item.productoId, item.varianteId)
                              }
                              className="p-1 rounded-full bg-gray-200 hover:bg-gray-300 transition"
                              aria-label={`Increase ${item.name} quantity`}
                            >
                              <FaPlus size={12} />
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            removeItem(item.productoId, item.varianteId)
                          }
                          className="text-red-500 p-1 hover:bg-red-50 rounded-full transition"
                          aria-label={`Remove ${item.name} from cart`}
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
                <div className="flex justify-between text-lg font-semibold mb-4 text-gray-800">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <button
                  type="button"
                  disabled
                  className="w-full py-2 px-4 rounded-md text-white font-medium bg-gray-300 cursor-not-allowed"
                >
                  Checkout unavailable
                </button>
                <button
                  onClick={onClose}
                  className="w-full mt-2 py-2 px-4 rounded-md border border-gray-300 hover:bg-gray-100 transition"
                >
                  Continue shopping
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
