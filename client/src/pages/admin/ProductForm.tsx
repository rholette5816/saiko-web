import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import type { MenuBadge, MenuItem } from "@/lib/menuItems";
import { X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type ProductFormMode = "create" | "edit";

interface ProductCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface ProductFormItem extends MenuItem {
  categoryId: string;
  imageValue?: string | null;
  is_available?: boolean;
  sort_order?: number;
}

interface ProductFormProps {
  mode: ProductFormMode;
  initialItem?: ProductFormItem;
  onSaved: () => void;
  onCancel: () => void;
}

const badgeOptions: Array<{ value: "" | MenuBadge; label: string }> = [
  { value: "", label: "None" },
  { value: "bestseller", label: "Best Seller" },
  { value: "chefs-pick", label: "Chef's Pick" },
  { value: "new", label: "New" },
  { value: "spicy", label: "Spicy" },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function makeItemId(categoryId: string, name: string): string {
  const slug = slugify(name) || "item";
  const suffix = Date.now().toString(36).slice(-6);
  return `${categoryId}-${slug}-${suffix}`;
}

export default function ProductForm({ mode, initialItem, onSaved, onCancel }: ProductFormProps) {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [name, setName] = useState(initialItem?.name ?? "");
  const [categoryId, setCategoryId] = useState(initialItem?.categoryId ?? "");
  const [price, setPrice] = useState(initialItem ? String(initialItem.price) : "");
  const [description, setDescription] = useState(initialItem?.description ?? "");
  const [badge, setBadge] = useState<"" | MenuBadge>(initialItem?.badge ?? "");
  const [image, setImage] = useState(initialItem?.imageValue ?? initialItem?.image ?? "");
  const [isAvailable, setIsAvailable] = useState(initialItem?.is_available ?? true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadCategories() {
      const { data, error: loadError } = await supabase
        .from("menu_categories")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true });

      if (!active) return;
      if (loadError) {
        setError(loadError.message);
        setLoadingCategories(false);
        return;
      }

      const rows = (data ?? []) as ProductCategory[];
      setCategories(rows);
      setCategoryId((current) => current || rows[0]?.id || "");
      setLoadingCategories(false);
    }

    void loadCategories();
    return () => {
      active = false;
    };
  }, []);

  async function nextSortOrder(nextCategoryId: string): Promise<number> {
    if (mode === "edit") return initialItem?.sort_order ?? 0;
    const { data } = await supabase
      .from("menu_items")
      .select("sort_order")
      .eq("category_id", nextCategoryId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = data as { sort_order?: number | null } | null;
    return Number(row?.sort_order ?? -1) + 1;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const numericPrice = Number(price);
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!categoryId) {
      setError("Category is required.");
      return;
    }
    if (!Number.isInteger(numericPrice) || numericPrice < 0) {
      setError("Price must be a whole number.");
      return;
    }

    setSaving(true);
    const sortOrder = await nextSortOrder(categoryId);
    const payload = {
      id: mode === "edit" && initialItem ? initialItem.id : makeItemId(categoryId, trimmedName),
      category_id: categoryId,
      name: trimmedName,
      price: numericPrice,
      description: description.trim() || null,
      image: image.trim() || null,
      badge: badge || null,
      sort_order: sortOrder,
      is_available: isAvailable,
    };

    const { error: saveError } = await supabase.from("menu_items").upsert(payload, { onConflict: "id" });
    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0f13]/60 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#0d0f13]">{mode === "create" ? "New Item" : "Edit Item"}</h2>
            <p className="mt-1 text-sm text-[#705d48]">Save changes to the live menu database.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d8d2cb] text-[#0d0f13]"
            title="Close form"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">
              Name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2 text-sm normal-case tracking-normal text-[#0d0f13]"
                required
              />
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">
              Category
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                disabled={loadingCategories}
                className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2 text-sm normal-case tracking-normal text-[#0d0f13]"
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">
              Price
              <input
                type="number"
                min="0"
                step="1"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2 text-sm normal-case tracking-normal text-[#0d0f13]"
                required
              />
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">
              Badge
              <select
                value={badge}
                onChange={(event) => setBadge(event.target.value as "" | MenuBadge)}
                className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2 text-sm normal-case tracking-normal text-[#0d0f13]"
              >
                {badgeOptions.map((option) => (
                  <option key={option.value || "none"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-[#705d48]">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="mt-1 w-full resize-none rounded-lg border border-[#d8d2cb] px-3 py-2 text-sm normal-case tracking-normal text-[#0d0f13]"
            />
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wide text-[#705d48]">
            Image URL
            <input
              type="text"
              value={image}
              onChange={(event) => setImage(event.target.value)}
              placeholder="/menu-images/item.png"
              className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2 text-sm normal-case tracking-normal text-[#0d0f13]"
            />
          </label>

          <div className="flex items-center justify-between rounded-lg border border-[#d8d2cb] p-3">
            <div>
              <p className="text-sm font-semibold text-[#0d0f13]">Available</p>
              <p className="text-xs text-[#705d48]">Turn off to hide this item from the public menu.</p>
            </div>
            <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
          </div>

          {error && <p className="text-sm font-semibold text-[#ac312d]">{error}</p>}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="submit"
              disabled={saving || loadingCategories}
              className="h-11 rounded-lg bg-[#ac312d] text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Item"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="h-11 rounded-lg border border-[#0d0f13] text-sm font-semibold uppercase tracking-wide text-[#0d0f13] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
