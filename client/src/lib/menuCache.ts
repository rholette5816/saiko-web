import { fetchMenuCategories, type MenuCategory } from "@/lib/menuItems";
import { supabase, type BusinessSettings } from "@/lib/supabase";

interface CachedValue<T> {
  cachedAt: string;
  data: T;
}

type CacheRead<T> = { hit: true; data: T } | { hit: false };

function readCache<T>(key: string): CacheRead<T> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { hit: false };
    const cached = JSON.parse(raw) as Partial<CachedValue<T>>;
    if (!("data" in cached)) return { hit: false };
    return { hit: true, data: cached.data as T };
  } catch {
    return { hit: false };
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ cachedAt: new Date().toISOString(), data }));
  } catch {
    // Cache writes are best effort only.
  }
}

export async function fetchMenuCategoriesCached(scope: "public" | "admin"): Promise<MenuCategory[]> {
  const key = `saiko-menu-cache-${scope}`;
  try {
    const categories = await fetchMenuCategories(scope);
    writeCache(key, categories);
    return categories;
  } catch (error) {
    const cached = readCache<MenuCategory[]>(key);
    if (cached.hit) return cached.data;
    throw error;
  }
}

export async function fetchBusinessSettingsCached(): Promise<BusinessSettings | null> {
  const key = "saiko-business-settings-cache";
  try {
    const { data, error } = await supabase.from("business_settings").select("*").limit(1).maybeSingle();
    if (error) throw error;
    const settings = (data as BusinessSettings) ?? null;
    writeCache(key, settings);
    return settings;
  } catch (error) {
    const cached = readCache<BusinessSettings | null>(key);
    if (cached.hit) return cached.data;
    throw error;
  }
}
