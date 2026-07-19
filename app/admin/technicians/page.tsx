"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import AddTechnicianModal from "@/components/AddTechnicianModal";
import { Technician, TechnicianRole, Region, REGIONS } from "@/lib/types";

function TechnicianRow({ tech, onChange }: { tech: Technician; onChange: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [role, setRole] = useState<TechnicianRole>(tech.role);
  const [defaultRegion, setDefaultRegion] = useState<Region | "">(tech.default_region || "");
  const [regions, setRegions] = useState<Region[]>(tech.regions_subscribed || []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function toggleRegion(r: Region) {
    setRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    const { error } = await supabase
      .from("technicians")
      .update({ role, default_region: defaultRegion || null, regions_subscribed: regions })
      .eq("id", tech.id);
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    onChange();
  }

  async function handleToggleActive() {
    setSaving(true);
    const { error } = await supabase.from("technicians").update({ active: !tech.active }).eq("id", tech.id);
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    onChange();
  }

  async function handlePasswordReset() {
    setSaving(true);
    setMsg("");
    const { error } = await supabase.auth.resetPasswordForEmail(tech.email);
    setSaving(false);
    setMsg(error ? error.message : "Password reset email sent.");
  }

  return (
    <div className="card" style={{ opacity: tech.active ? 1 : 0.55 }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>
            {tech.name} {!tech.active && <span className="badge closed" style={{ marginLeft: 6 }}>Inactive</span>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
            {tech.email} · {tech.role}
            {tech.default_region ? ` · default ${tech.default_region}` : ""}
          </div>
        </div>
        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
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

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" disabled={saving} onClick={handleSave}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button className="btn secondary" disabled={saving} onClick={handlePasswordReset}>
              Send password reset
            </button>
            <button className="btn secondary" disabled={saving} onClick={handleToggleActive}>
              {tech.active ? "Deactivate" : "Reactivate"}
            </button>
          </div>
          {msg && <div className="msg error">{msg}</div>}
        </div>
      )}
    </div>
  );
}

function AdminContent() {
  const { technician } = useAuth();
  const isAdmin = technician?.role === "admin";
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("technicians").select("*").order("name");
    if (!error) setTechnicians((data as Technician[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [load, isAdmin]);

  if (technician && !isAdmin) {
    return (
      <div className="container">
        <div className="empty-state">This page is for admins only.</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="board-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Technician roster</h1>
        <button className="btn" onClick={() => setShowAdd(true)}>
          Add technician
        </button>
      </div>

      {loading && <div className="empty-state">Loading…</div>}

      {!loading && (
        <div className="board-grid" style={{ alignItems: "start" }}>
          {technicians.map((t) => (
            <TechnicianRow key={t.id} tech={t} onChange={load} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddTechnicianModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}

export default function AdminTechniciansPage() {
  return (
    <RequireAuth>
      <AdminContent />
    </RequireAuth>
  );
}
