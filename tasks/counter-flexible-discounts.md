# Task: counter-flexible-discounts

## Goal

Replace the hardcoded Senior/PWD 20% checkbox in Counter Mode with a flexible discount type selector where staff picks the type (Senior Citizen, PWD, Employee, Friends & Family, Custom) and manually inputs the percentage.

## Why

The counter currently only supports one hardcoded discount: Senior/PWD at 20%. The business needs to apply other discount types at different rates per transaction. Staff must be able to select the type and enter the percentage themselves. Senior/PWD still requires an ID Number and Full Name for BIR compliance.

## Files to modify

- `client/src/pages/admin/Counter.tsx` — Replace `isSeniorPwd` boolean + `seniorId` + `seniorName` state with a new discount system. See detailed instructions below.
- `client/src/components/CounterReceipt.tsx` — Replace `seniorPwdDiscount`, `seniorPwdId`, `seniorPwdName` props with `discountType`, `discountPct`, `discountAmount`, `discountIdNumber`, `discountHolderName`. Render the discount label dynamically on the receipt.

## Detailed instructions: Counter.tsx

### State changes

Remove these state variables:
```
isSeniorPwd, seniorId, seniorName
```

Add these state variables:
```typescript
const [discountType, setDiscountType] = useState<DiscountType>("none");
const [discountPct, setDiscountPct] = useState<number>(0);
const [discountIdNumber, setDiscountIdNumber] = useState("");
const [discountHolderName, setDiscountHolderName] = useState("");
```

### New type

Add this type near the top of the file (after the existing `PaymentMethod` type):

```typescript
type DiscountType = "none" | "senior" | "pwd" | "employee" | "friends" | "custom";
```

### Discount config map

Add this constant after the type (do not use em dashes in labels):

```typescript
const DISCOUNT_PRESETS: Record<DiscountType, { label: string; defaultPct: number; requiresId: boolean }> = {
  none:     { label: "None",           defaultPct: 0,  requiresId: false },
  senior:   { label: "Senior Citizen", defaultPct: 20, requiresId: true  },
  pwd:      { label: "PWD",            defaultPct: 20, requiresId: true  },
  employee: { label: "Employee",       defaultPct: 10, requiresId: false },
  friends:  { label: "Friends",        defaultPct: 15, requiresId: false },
  custom:   { label: "Custom",         defaultPct: 0,  requiresId: false },
};
```

### CompletedOrder interface changes

Replace:
```typescript
seniorPwdDiscount: number;
seniorPwdId: string | null;
seniorPwdName: string | null;
```
With:
```typescript
discountType: DiscountType;
discountPct: number;
discountAmount: number;
discountIdNumber: string | null;
discountHolderName: string | null;
```

### pricing useMemo changes

Replace the current `pricing` useMemo. The new version must:
- Use `discountPct` (0-100 number) to compute `discountAmount = round2(subtotal * discountPct / 100)`
- When `discountType !== "none"` and `(discountType === "senior" || discountType === "pwd")`: apply VAT-exempt logic (same as current `isSeniorPwd` branch)
- When `discountType !== "none"` and type is employee/friends/custom: simple discount, no VAT-exempt logic, total = subtotal - discountAmount (still apply normal VAT if vat_registered)
- When `discountType === "none"`: same as current non-senior branch

New pricing useMemo:

```typescript
const pricing = useMemo(() => {
  const discountAmount = discountType !== "none" ? round2(subtotal * discountPct / 100) : 0;
  const isVatExempt = discountType === "senior" || discountType === "pwd";

  if (isVatExempt) {
    const vatExemptSales = round2(subtotal - discountAmount);
    return { discountAmount, vatableSales: 0, vatAmount: 0, vatExemptSales, total: vatExemptSales };
  }

  const base = round2(subtotal - discountAmount);

  if (resolvedSettings.vat_registered) {
    const vatAmount = round2((base * resolvedSettings.vat_rate) / (100 + resolvedSettings.vat_rate));
    const vatableSales = round2(base - vatAmount);
    return { discountAmount, vatableSales, vatAmount, vatExemptSales: 0, total: base };
  }

  return { discountAmount, vatableSales: 0, vatAmount: 0, vatExemptSales: 0, total: base };
}, [discountType, discountPct, resolvedSettings.vat_rate, resolvedSettings.vat_registered, subtotal]);
```

### resetForm changes

Replace `setIsSeniorPwd(false); setSeniorId(""); setSeniorName("");` with:
```typescript
setDiscountType("none");
setDiscountPct(0);
setDiscountIdNumber("");
setDiscountHolderName("");
```

### handleSubmit validation changes

Replace the senior/PWD ID validation block:
```typescript
if (isSeniorPwd && (!seniorId.trim() || !seniorName.trim())) {
  setError("Senior/PWD ID Number and Full Name are required.");
  setSubmitting(false);
  return;
}
```
With:
```typescript
if (DISCOUNT_PRESETS[discountType].requiresId && (!discountIdNumber.trim() || !discountHolderName.trim())) {
  setError(`${DISCOUNT_PRESETS[discountType].label} discount requires ID Number and Full Name.`);
  setSubmitting(false);
  return;
}
```

### Supabase RPC call changes

In the `supabase.rpc("place_counter_order", {...})` call, replace:
```typescript
p_senior_pwd: isSeniorPwd,
p_senior_pwd_id: isSeniorPwd ? seniorId.trim() : null,
p_senior_pwd_name: isSeniorPwd ? seniorName.trim() : null,
```
With:
```typescript
p_senior_pwd: discountType === "senior" || discountType === "pwd",
p_senior_pwd_id: DISCOUNT_PRESETS[discountType].requiresId ? discountIdNumber.trim() : null,
p_senior_pwd_name: DISCOUNT_PRESETS[discountType].requiresId ? discountHolderName.trim() : null,
```

### CompletedOrder construction changes

Replace:
```typescript
seniorPwdDiscount: Number(row?.senior_pwd_discount ?? pricing.seniorDiscount),
seniorPwdId: isSeniorPwd ? seniorId.trim() : null,
seniorPwdName: isSeniorPwd ? seniorName.trim() : null,
```
With:
```typescript
discountType,
discountPct,
discountAmount: Number(row?.senior_pwd_discount ?? pricing.discountAmount),
discountIdNumber: DISCOUNT_PRESETS[discountType].requiresId ? discountIdNumber.trim() : null,
discountHolderName: DISCOUNT_PRESETS[discountType].requiresId ? discountHolderName.trim() : null,
```

### UI changes in renderOrderPanel

Replace the entire Senior/PWD section (the `<div className="rounded-lg border ...">` block containing the checkbox and id/name inputs) with this new discount section:

```tsx
<div className="rounded-lg border border-[#d8d2cb] p-3 space-y-3">
  <p className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Discount</p>
  <div className="grid grid-cols-3 gap-1.5">
    {(Object.keys(DISCOUNT_PRESETS) as DiscountType[]).map((type) => (
      <label
        key={type}
        className={`rounded-lg border px-2 py-2 text-center text-xs font-semibold cursor-pointer ${
          discountType === type
            ? "border-[#c08643] bg-[#c08643] text-white"
            : "border-[#d8d2cb] text-[#0d0f13]"
        }`}
      >
        <input
          type="radio"
          className="sr-only"
          name={`discount-type-${isMobile ? "mobile" : "desktop"}`}
          value={type}
          checked={discountType === type}
          onChange={() => {
            setDiscountType(type);
            setDiscountPct(DISCOUNT_PRESETS[type].defaultPct);
            setDiscountIdNumber("");
            setDiscountHolderName("");
          }}
        />
        {DISCOUNT_PRESETS[type].label}
      </label>
    ))}
  </div>

  {discountType !== "none" && (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Discount %</label>
      <input
        type="number"
        min="0"
        max="100"
        step="1"
        value={discountPct}
        onChange={(e) => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value))))}
        className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-2.5 py-2 text-sm"
      />
    </div>
  )}

  {discountType !== "none" && DISCOUNT_PRESETS[discountType].requiresId && (
    <div className="space-y-2">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">ID Number</label>
        <input
          type="text"
          value={discountIdNumber}
          onChange={(e) => setDiscountIdNumber(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm"
          placeholder="Required"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Full Name</label>
        <input
          type="text"
          value={discountHolderName}
          onChange={(e) => setDiscountHolderName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm"
          placeholder="Required"
        />
      </div>
    </div>
  )}
</div>
```

### Order summary display changes

Replace:
```tsx
{pricing.seniorDiscount > 0 && (
  <div className="flex items-center justify-between">
    <span className="text-[#705d48]">Senior/PWD (-20%)</span>
    <span className="font-semibold text-[#2d7a3e]">-{currencyPhp(pricing.seniorDiscount)}</span>
  </div>
)}
```
With:
```tsx
{pricing.discountAmount > 0 && (
  <div className="flex items-center justify-between">
    <span className="text-[#705d48]">{DISCOUNT_PRESETS[discountType].label} (-{discountPct}%)</span>
    <span className="font-semibold text-[#2d7a3e]">-{currencyPhp(pricing.discountAmount)}</span>
  </div>
)}
```

Replace the VAT-exempt sales condition:
```tsx
{isSeniorPwd && (
```
With:
```tsx
{(discountType === "senior" || discountType === "pwd") && (
```

### CounterReceipt usage in JSX

When rendering `<CounterReceipt ... />` near the bottom of the file, replace the old props:
```tsx
seniorPwdDiscount={printingOrder.seniorPwdDiscount}
seniorPwdId={printingOrder.seniorPwdId}
seniorPwdName={printingOrder.seniorPwdName}
```
With:
```tsx
discountType={printingOrder.discountType}
discountPct={printingOrder.discountPct}
discountAmount={printingOrder.discountAmount}
discountIdNumber={printingOrder.discountIdNumber}
discountHolderName={printingOrder.discountHolderName}
```

## Detailed instructions: CounterReceipt.tsx

### Props interface changes

Replace:
```typescript
seniorPwdDiscount: number;
seniorPwdId: string | null;
seniorPwdName: string | null;
```
With:
```typescript
discountType: string;
discountPct: number;
discountAmount: number;
discountIdNumber: string | null;
discountHolderName: string | null;
```

### Receipt rendering changes

Find where `seniorPwdDiscount` is rendered (the discount line on the receipt). Replace all references to `seniorPwdDiscount`, `seniorPwdId`, `seniorPwdName` with the new props.

The discount line should render dynamically:
- Label: use the discount type label. Map using this inline lookup (no import needed):
  ```typescript
  const DISCOUNT_LABELS: Record<string, string> = {
    senior: "Senior Citizen",
    pwd: "PWD",
    employee: "Employee",
    friends: "Friends",
    custom: "Custom",
  };
  const discountLabel = DISCOUNT_LABELS[props.discountType] ?? props.discountType;
  ```
- Show discount line only when `props.discountAmount > 0`
- Format: `{discountLabel} -{props.discountPct}%` on the left, `-PHP {amount}` on the right
- Show ID Number and Full Name lines only when `props.discountIdNumber` is not null/empty

## Deployment

After making all changes:
1. Run `pnpm build` from the `saiko_web/` root. It must succeed with no errors.
2. Run `vercel --prod` from the `saiko_web/` root to deploy to production.

## Constraints

- Inherits all rules from `AGENTS.md` (no em dashes, brand colors, no new npm deps, no commits, no pushes)
- Do not touch the Supabase migration or RPC function signatures. The existing `p_senior_pwd`, `p_senior_pwd_id`, `p_senior_pwd_name` params are preserved with backward-compatible values.
- Do not modify any other files outside the two listed above.

## Reference patterns

- Payment method button group (existing pattern to match for the discount type buttons): lines 453-475 in `client/src/pages/admin/Counter.tsx`

## Acceptance criteria

- [ ] `grep -rn "isSeniorPwd\|seniorId\|seniorName\|seniorDiscount" client/src` returns nothing
- [ ] `grep -rn "DISCOUNT_PRESETS" client/src/pages/admin/Counter.tsx` returns at least 5 matches
- [ ] `grep -rn "discountType\|discountPct\|discountAmount" client/src/components/CounterReceipt.tsx` returns at least 3 matches
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `pnpm build` succeeds
- [ ] `vercel --prod` deploy succeeds

## Out of scope

- Supabase database migrations or RPC changes
- Any page outside Counter.tsx and CounterReceipt.tsx
- Adding a new discount type beyond the 6 defined
- Persisting discount presets to business settings

## Notes for Codex

The existing `place_counter_order` RPC uses `p_senior_pwd` (boolean) and `p_senior_pwd_id`/`p_senior_pwd_name` for BIR compliance. We preserve this by passing `p_senior_pwd = true` only when the selected type is "senior" or "pwd". No DB migration needed.

The `row?.senior_pwd_discount` field returned by the RPC is reused to populate `discountAmount` in the completed order object. This is correct because the RPC computes the discount amount regardless of type.

The `vercel` CLI is already configured via `vercel.json`. Run it from the `saiko_web/` root.
