import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";

// Deprecated compatibility layer. Product state now lives in menu_items.
interface Override {
  is_available: boolean;
  is_best_seller: boolean;
}

const DEFAULT_OVERRIDE: Override = { is_available: true, is_best_seller: false };

interface ContextValue {
  getOverride: (itemId: string) => Override;
  loading: boolean;
}

const Ctx = createContext<ContextValue | null>(null);

export function MenuOverridesProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Map<string, Override>>(new Map());
  const [loading, setLoading] = useState(true);

  async function fetchOverrides() {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, is_available, is_best_seller");

    if (error) {
      setLoading(false);
      return;
    }

    const next = new Map<string, Override>();
    for (const row of data ?? []) {
      next.set(row.id, {
        is_available: row.is_available,
        is_best_seller: row.is_best_seller,
      });
    }
    setOverrides(next);
    setLoading(false);
  }

  useEffect(() => {
    fetchOverrides();
    const onFocus = () => fetchOverrides();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <Ctx.Provider value={{ getOverride: (id) => overrides.get(id) ?? DEFAULT_OVERRIDE, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMenuOverrides() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useMenuOverrides must be used inside MenuOverridesProvider");
  return value;
}
