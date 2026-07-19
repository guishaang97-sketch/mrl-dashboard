"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";

export default function LoginPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && session) router.replace("/board");
  }, [loading, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/board");
  }

  return (
    <div className="container">
      <div className="login-wrap">
        <div className="login-brand">
          <img src="/logo-icon.png" alt="MRL Cybertec" style={{ width: 48, height: 48, objectFit: "contain", margin: "0 auto 10px" }} />
          <h1>MRL Cybertec</h1>
          <p>Service Ticketing Dashboard</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button className="btn block" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
            {error && <div className="msg error">{error}</div>}
          </form>
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--ink-soft)", marginTop: 16 }}>
          Don&apos;t have an account? Ask your admin to set one up in Supabase.
        </p>
      </div>
    </div>
  );
}
