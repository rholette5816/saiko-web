import { signIn, useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) navigate("/admin");
  }, [loading, session, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate("/admin");
  }

  return (
    <div className="min-h-screen bg-[#ebe9e6] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 md:p-8">
        <h1 className="font-poppins text-2xl font-bold text-[#0d0f13] mb-1">Admin Login</h1>
        <p className="text-sm text-[#705d48] mb-5">Sign in to manage Saiko orders.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-[#0d0f13] block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c08643]"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-[#0d0f13] block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c08643]"
            />
          </div>
          {error && <p className="text-sm text-[#ac312d]">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-[#0d0f13] text-white text-sm font-semibold uppercase tracking-wide disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
