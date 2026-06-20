import featuredDragonRoll from "@/assets/images/featured-dragon-roll.png";
import featuredGyoza from "@/assets/images/featured-gyoza.png";
import featuredLavaRice from "@/assets/images/featured-lava-rice.png";
import featuredWagyuTeppan from "@/assets/images/featured-wagyu-teppan.png";
import { supabase } from "./supabase";
import type { MenuBadge, MenuCategory, MenuItem } from "./menuData";

export type { MenuBadge, MenuCategory, MenuItem } from "./menuData";

interface MenuCategoryRow {
  id: string;
  name: string;
  emoji: string;
  sort_order: number;
}

interface MenuItemRow {
  id: string;
  category_id: string;
  name: string;
  price: number | string;
  description: string | null;
  image: string | null;
  badge: MenuBadge | null;
  sort_order: number;
  is_best_seller?: boolean | null;
  requires_spice_level?: boolean | null;
}

const legacyAssetImages: Record<string, string> = {
  "asset:featured-dragon-roll.png": featuredDragonRoll,
  "asset:featured-gyoza.png": featuredGyoza,
  "asset:featured-lava-rice.png": featuredLavaRice,
  "asset:featured-wagyu-teppan.png": featuredWagyuTeppan,
};

function resolveImage(image: string | null): string | undefined {
  if (!image) return undefined;
  return legacyAssetImages[image] ?? image;
}

function toMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    description: row.description ?? undefined,
    image: resolveImage(row.image),
    badge: row.badge ?? (row.is_best_seller ? "bestseller" : undefined),
    requiresSpiceLevel: row.requires_spice_level ?? false,
  };
}

export async function fetchMenuCategories(scope: "public" | "admin" = "public"): Promise<MenuCategory[]> {
  let itemsQuery = supabase
    .from("menu_items")
    .select("id, category_id, name, price, description, image, badge, sort_order, is_best_seller, requires_spice_level")
    .eq("is_available", true)
    .order("sort_order", { ascending: true });

  if (scope === "public") {
    itemsQuery = itemsQuery.eq("is_public", true);
  }

  const [categoriesResult, itemsResult] = await Promise.all([
    supabase.from("menu_categories").select("id, name, emoji, sort_order").order("sort_order", { ascending: true }),
    itemsQuery,
  ]);

  if (categoriesResult.error) throw categoriesResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const categories = (categoriesResult.data ?? []) as MenuCategoryRow[];
  const items = (itemsResult.data ?? []) as MenuItemRow[];
  const itemsByCategory = new Map<string, MenuItem[]>();

  for (const item of items) {
    const current = itemsByCategory.get(item.category_id) ?? [];
    current.push(toMenuItem(item));
    itemsByCategory.set(item.category_id, current);
  }

  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      emoji: category.emoji,
      items: itemsByCategory.get(category.id) ?? [],
    }))
    .filter((category) => category.items.length > 0);
}
