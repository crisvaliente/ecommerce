import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useReducer,
  useState,
} from 'react';

export const CART_PERSISTENCE_VERSION = 1 as const;
const STORAGE_KEY = `ecommerce.cart.v${CART_PERSISTENCE_VERSION}`;
const LEGACY_STORAGE_KEY = 'shoppingCart';
const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;

export type CartLine = {
  productoId: string;
  varianteId: string | null;
  name: string;
  price: number;
  image: string;
  quantity: number;
};

export type CartState = {
  empresaId: string | null;
  items: CartLine[];
};

export type PersistedCartV1 = {
  version: typeof CART_PERSISTENCE_VERSION;
  empresaId: string;
  items: CartLine[];
};

type CartIdentity = Pick<CartLine, 'productoId' | 'varianteId'>;
type NewCartLine = Omit<CartLine, 'quantity'>;

type CartAction =
  | { type: 'hydrate'; state: CartState }
  | { type: 'add'; empresaId: string; item: NewCartLine }
  | { type: 'increment'; identity: CartIdentity }
  | { type: 'decrement'; identity: CartIdentity }
  | { type: 'remove'; identity: CartIdentity }
  | { type: 'clear' };

interface CartContextType extends CartState {
  addItem: (empresaId: string, item: NewCartLine) => void;
  incrementItem: (productoId: string, varianteId: string | null) => void;
  decrementItem: (productoId: string, varianteId: string | null) => void;
  removeItem: (productoId: string, varianteId: string | null) => void;
  clearCart: () => void;
  itemCount: number;
  total: number;
}

interface CartProviderProps {
  children: ReactNode;
}

const EMPTY_CART: CartState = { empresaId: null, items: [] };

const CartContext = createContext<CartContextType | undefined>(undefined);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isValidVariant = (value: unknown): value is string | null =>
  value === null || isNonEmptyString(value);

const isValidLineMetadata = (line: NewCartLine): boolean =>
  isNonEmptyString(line.productoId) &&
  isValidVariant(line.varianteId) &&
  isNonEmptyString(line.name) &&
  Number.isFinite(line.price) &&
  line.price >= 0 &&
  isNonEmptyString(line.image);

const isSameIdentity = (line: CartLine, identity: CartIdentity): boolean =>
  line.productoId === identity.productoId &&
  line.varianteId === identity.varianteId;

export const getCartIdentityKey = ({
  productoId,
  varianteId,
}: CartIdentity): string =>
  JSON.stringify([productoId, varianteId]);

const incrementLineAtIndex = (state: CartState, index: number): CartState => {
  const item = state.items[index];
  if (!item || item.quantity >= MAX_QUANTITY) {
    return state;
  }

  const items = [...state.items];
  items[index] = { ...item, quantity: item.quantity + 1 };
  return { ...state, items };
};

const withoutLine = (state: CartState, identity: CartIdentity): CartState => {
  const items = state.items.filter((item) => !isSameIdentity(item, identity));

  if (items.length === state.items.length) {
    return state;
  }

  return items.length === 0 ? EMPTY_CART : { ...state, items };
};

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'add': {
      if (
        !isNonEmptyString(action.empresaId) ||
        !isValidLineMetadata(action.item) ||
        (state.empresaId !== null && state.empresaId !== action.empresaId)
      ) {
        return state;
      }

      const existingIndex = state.items.findIndex((item) =>
        isSameIdentity(item, action.item),
      );

      if (existingIndex >= 0) {
        return incrementLineAtIndex(state, existingIndex);
      }

      if (state.items.length >= MAX_ITEMS) {
        return state;
      }

      return {
        empresaId: action.empresaId,
        items: [...state.items, { ...action.item, quantity: 1 }],
      };
    }
    case 'increment': {
      const index = state.items.findIndex((item) =>
        isSameIdentity(item, action.identity),
      );
      return incrementLineAtIndex(state, index);
    }
    case 'decrement': {
      const item = state.items.find((candidate) =>
        isSameIdentity(candidate, action.identity),
      );
      if (!item) {
        return state;
      }
      if (item.quantity === 1) {
        return withoutLine(state, action.identity);
      }

      return {
        ...state,
        items: state.items.map((candidate) =>
          isSameIdentity(candidate, action.identity)
            ? { ...candidate, quantity: candidate.quantity - 1 }
            : candidate,
        ),
      };
    }
    case 'remove':
      return withoutLine(state, action.identity);
    case 'clear':
      return state.items.length === 0 ? state : EMPTY_CART;
  }
};

const parsePersistedCart = (value: string): CartState | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const snapshot = parsed as Partial<PersistedCartV1>;
  if (
    snapshot.version !== CART_PERSISTENCE_VERSION ||
    !isNonEmptyString(snapshot.empresaId) ||
    !Array.isArray(snapshot.items) ||
    snapshot.items.length < 1 ||
    snapshot.items.length > MAX_ITEMS
  ) {
    return null;
  }

  const identities = new Set<string>();
  for (const item of snapshot.items) {
    if (typeof item !== 'object' || item === null) {
      return null;
    }

    const line = item as Partial<CartLine>;
    if (
      !isValidLineMetadata(line as NewCartLine) ||
      !Number.isInteger(line.quantity) ||
      (line.quantity as number) < 1 ||
      (line.quantity as number) > MAX_QUANTITY
    ) {
      return null;
    }

    const key = getCartIdentityKey(line as CartIdentity);
    if (identities.has(key)) {
      return null;
    }
    identities.add(key);
  }

  return {
    empresaId: snapshot.empresaId,
    items: snapshot.items as CartLine[],
  };
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, EMPTY_CART);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      const storedCart = window.localStorage.getItem(STORAGE_KEY);

      if (storedCart !== null) {
        const hydratedCart = parsePersistedCart(storedCart);
        if (hydratedCart) {
          dispatch({ type: 'hydrate', state: hydratedCart });
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.warn('Cart storage hydration failed; using in-memory state.', error);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') {
      return;
    }

    try {
      if (state.items.length === 0 || state.empresaId === null) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }

      const snapshot: PersistedCartV1 = {
        version: CART_PERSISTENCE_VERSION,
        empresaId: state.empresaId,
        items: state.items,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn('Cart storage persistence failed; using in-memory state.', error);
    }
  }, [isHydrated, state]);

  const itemCount = state.items.reduce(
    (count, item) => count + item.quantity,
    0,
  );
  const total = state.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        ...state,
        addItem: (empresaId, item) =>
          dispatch({ type: 'add', empresaId, item }),
        incrementItem: (productoId, varianteId) =>
          dispatch({ type: 'increment', identity: { productoId, varianteId } }),
        decrementItem: (productoId, varianteId) =>
          dispatch({ type: 'decrement', identity: { productoId, varianteId } }),
        removeItem: (productoId, varianteId) =>
          dispatch({ type: 'remove', identity: { productoId, varianteId } }),
        clearCart: () => dispatch({ type: 'clear' }),
        itemCount,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
