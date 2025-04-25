import React, { createContext, useContext, useState, ReactNode } from 'react';

// Interfaz básica para los elementos del carrito
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

// Interfaz para el contexto
interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  total: number;
}

// Valor default para el contexto
const defaultContextValue: CartContextType = {
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  itemCount: 0,
  total: 0
};

// Creación del contexto con un valor por defecto
const CartContext = createContext<CartContextType>(defaultContextValue);

// Hook personalizado para usar el contexto
export const useCart = () => {
  return useContext(CartContext);
};

// Proveedor del contexto
interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  // Operaciones básicas del carrito
  const addItem = (newItem: Omit<CartItem, 'quantity'>) => {
    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === newItem.id);
      if (existingItem) {
        return prevItems.map(item => 
          item.id === newItem.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      } else {
        return [...prevItems, { ...newItem, quantity: 1 }];
      }
    });
  };

  const removeItem = (id: string) => {
    setItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(id);
      return;
    }
    
    setItems(prevItems => 
      prevItems.map(item => 
        item.id === id ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  // Calculamos valores derivados
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      itemCount,
      total
    }}>
      {children}
    </CartContext.Provider>
  );
};
