"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { REGIONS, Region, TechnicianRole } from "@/lib/types";

const FUNCTIONS_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(".supabase.co", ".functions.supabase.co");

export default function AddTechnicianModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<TechnicianRole>("technician");
  const [defaultRegion, setDefaultRegion] = useState<Region | "">("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleRegion(r: Region) {
    setRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !password) {
      setError("Name, email, and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!session?.access_token) {
      setError("Your session isn't ready yet — wait a moment and try again, or refresh the page.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${FUNCTIONS_URL}/create-technician`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          password,
          role,
          regions_subscribed: regions,
          default_region: defaultRegion || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create technician.");
        setSubmitting(false);
        return;
      }
      onCreated();
    } catch (err) {
      console.error(err);
      setError("Could not reach the server.");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add technician</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </div>
          <div className="field">
            <label>Phone (optional)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>Temporary password</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 4 }}>
              Share this with them directly — there's no invite email flow yet. They can change it later via
              &quot;Forgot password&quot; on the login screen.
            </div>
          </div>
          <div className="field">
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as TechnicianRole)}>
              <option value="technician">Technician</option>
              <option value="dispatcher">Dispatcher</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="field">
            <label>Default region (board filter default)</label>
            <select value={defaultRegion} onChange={(e) => setDefaultRegion(e.target.value as Region | "")}>
              <option value="">—</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Notification regions</label>
            <div className="team-list">
              {REGIONS.map((r) => (
                <label key={r} className="team-member" style={{ cursor: "pointer" }}>
                  <span>{r}</span>
                  <input type="checkbox" checked={regions.includes(r)} onChange={() => toggleRegion(r)} style={{ width: "auto" }} />
                </label>
              ))}
            </div>
          </div>
          <button className="btn block" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create technician"}
          </button>
          {error && <div className="msg error">{error}</div>}
        </form>
      </div>
    </div>
  );
}
