import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, type BusinessSettings } from "./supabase";

interface BusinessSettingsContextValue {
  settings: BusinessSettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<BusinessSettingsContextValue | null>(null);

export function BusinessSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const { data } = await supabase.from("business_settings").select("*").limit(1).maybeSingle();
    setSettings((data as BusinessSettings) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return <Ctx.Provider value={{ settings, loading, refresh }}>{children}</Ctx.Provider>;
}

export function useBusinessSettings() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useBusinessSettings must be used inside BusinessSettingsProvider");
  return value;
}
