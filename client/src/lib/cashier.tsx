import { useEffect, useState } from "react";

export const CASHIER_OPTIONS = ["Carin", "Kikay", "Sadam", "Bell"];

const CASHIER_STORAGE_KEY = "saiko-active-cashier";
const CASHIER_EVENT = "saiko:cashier-change";

function normalizeCashier(value: string | null | undefined): string {
  const match = CASHIER_OPTIONS.find((name) => name.toLowerCase() === String(value ?? "").trim().toLowerCase());
  return match ?? CASHIER_OPTIONS[0];
}

export function getActiveCashier(): string {
  if (typeof window === "undefined") return CASHIER_OPTIONS[0];
  return normalizeCashier(window.localStorage.getItem(CASHIER_STORAGE_KEY));
}

export function setActiveCashierName(name: string): string {
  const next = normalizeCashier(name);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CASHIER_STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(CASHIER_EVENT, { detail: next }));
  }
  return next;
}

export function useActiveCashier() {
  const [activeCashier, setActiveCashierState] = useState(getActiveCashier);

  useEffect(() => {
    function syncFromStorage() {
      setActiveCashierState(getActiveCashier());
    }

    function syncFromEvent(event: Event) {
      const next = event instanceof CustomEvent ? event.detail : null;
      setActiveCashierState(normalizeCashier(next));
    }

    window.addEventListener("storage", syncFromStorage);
    window.addEventListener(CASHIER_EVENT, syncFromEvent);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener(CASHIER_EVENT, syncFromEvent);
    };
  }, []);

  function setActiveCashier(name: string) {
    setActiveCashierState(setActiveCashierName(name));
  }

  return { activeCashier, setActiveCashier, cashierOptions: CASHIER_OPTIONS };
}