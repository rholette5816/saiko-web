import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface CartContextValue {
  items: CartItem[];
  totalQty: number;
  totalPrice: number;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "saiko-cart-v1";

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (it) =>
        it && typeof it.id === "string" && typeof it.name === "string" &&
        typeof it.price === "number" && typeof it.quantity === "number",
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  function add(item: Omit<CartItem, "quantity">, qty = 1) {
    setItems((cur) => {
      const existing = cur.find((i) => i.id === item.id);
      if (existing) {
        return cur.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + qty } : i,
        );
      }
      return [...cur, { ...item, quantity: qty }];
    });
  }

  function remove(id: string) {
    setItems((cur) => cur.filter((i) => i.id !== id));
  }

  function setQty(id: string, qty: number) {
    if (qty <= 0) return remove(id);
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, quantity: qty } : i)));
  }

  function clear() {
    setItems([]);
  }

  const totalQty = items.reduce((n, i) => n + i.quantity, 0);
  const totalPrice = items.reduce((n, i) => n + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        totalQty,
        totalPrice,
        add,
        remove,
        setQty,
        clear,
        isOpen,
        openDrawer: () => setIsOpen(true),
        closeDrawer: () => setIsOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
