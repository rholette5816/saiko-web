import { useAuth } from "@/lib/auth";
import { type ReactNode, useEffect } from "react";
import { useLocation } from "wouter";

export function AdminGuard({ children, adminOnly }: { children: ReactNode; adminOnly?: boolean }) {
  const { session, loading, role } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate("/admin/login");
      return;
    }
    if (adminOnly && role !== "admin") {
      navigate("/admin/tables");
    }
  }, [loading, session, role, adminOnly, navigate]);

  if (loading || !session || (adminOnly && role !== "admin")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ebe9e6]">
        <div className="w-8 h-8 border-4 border-[#c08643] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
