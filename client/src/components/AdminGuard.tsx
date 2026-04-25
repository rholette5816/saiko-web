import { useAuth } from "@/lib/auth";
import { type ReactNode, useEffect } from "react";
import { useLocation } from "wouter";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !session) navigate("/admin/login");
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ebe9e6]">
        <div className="w-8 h-8 border-4 border-[#c08643] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
