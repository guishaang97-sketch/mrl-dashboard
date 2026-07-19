"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import { REGIONS, Region } from "@/lib/types";

export default function RegionSettingsModal({ onClose }: { onClose: () => void }) {
  const { technician, refreshTechnician } = useAuth();
  const [selected, setSelected] = useState<Region[]>(technician?.regions_subscribed || []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function toggle(region: Region) {
    setSelected((prev) => (prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]));
  }

  async function handleSave() {
    if (!technician) return;
    setSaving(true);
    setMsg("");
    const { error } = await supabase
      .from("technicians")
      .update({ regions_subscribed: selected })
      .eq("id", technician.id);
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    await refreshTechnician();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>Region notifications</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: -6, marginBottom: 16 }}>
          You'll get a push notification when a new ticket comes in for any region checked below. This
          doesn't affect which tickets you can see or claim — just which ones alert you.
        </p>

        <div className="team-list" style={{ marginBottom: 16 }}>
          {REGIONS.map((r) => (
            <label key={r} className="team-member" style={{ cursor: "pointer" }}>
              <span>{r}</span>
              <input type="checkbox" checked={selected.includes(r)} onChange={() => toggle(r)} style={{ width: "auto" }} />
            </label>
          ))}
        </div>

        <button className="btn block" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        {msg && <div className="msg error">{msg}</div>}
      </div>
    </div>
  );
}
