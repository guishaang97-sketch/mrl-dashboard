"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Technician } from "@/lib/types";

interface TeamMemberRow {
  technician_id: string;
  technicians: Pick<Technician, "id" | "name">;
}

export default function TeamPanel({
  ticketId,
  primaryAssignee,
  teamMembers,
  allTechnicians,
  currentTechnician,
  canManage,
  isDispatcherOrAdmin,
  isViewer,
  onChange,
  onReassignLead,
}: {
  ticketId: string;
  primaryAssignee: Technician | null;
  teamMembers: TeamMemberRow[];
  allTechnicians: Technician[];
  currentTechnician: Technician | null;
  canManage: boolean;
  isDispatcherOrAdmin: boolean;
  isViewer: boolean;
  onChange: () => void;
  onReassignLead: (technicianId: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const alreadyOnTeam =
    !!currentTechnician &&
    (primaryAssignee?.id === currentTechnician.id || teamMembers.some((m) => m.technician_id === currentTechnician.id));

  async function addMember(technicianId: string) {
    if (!technicianId) return;
    setBusy(true);
    await supabase.from("ticket_assignees").insert({ ticket_id: ticketId, technician_id: technicianId });
    setBusy(false);
    onChange();
  }

  async function removeMember(technicianId: string) {
    setBusy(true);
    await supabase.from("ticket_assignees").delete().eq("ticket_id", ticketId).eq("technician_id", technicianId);
    setBusy(false);
    onChange();
  }

  const addableTechnicians = allTechnicians.filter(
    (t) => t.id !== primaryAssignee?.id && !teamMembers.some((m) => m.technician_id === t.id),
  );

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="section-title" style={{ marginTop: 0 }}>
        Team
      </div>

      <div className="team-list">
        {primaryAssignee && (
          <div className="team-member">
            <span>{primaryAssignee.name}</span>
            <span className="role-tag">Lead</span>
          </div>
        )}
        {teamMembers.map((m) => (
          <div className="team-member" key={m.technician_id}>
            <span>{m.technicians.name}</span>
            {(canManage || m.technician_id === currentTechnician?.id) && !isViewer && (
              <button disabled={busy} onClick={() => removeMember(m.technician_id)}>
                Remove
              </button>
            )}
          </div>
        ))}
        {!primaryAssignee && teamMembers.length === 0 && (
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>No one assigned yet.</div>
        )}
      </div>

      {!isViewer && !alreadyOnTeam && primaryAssignee && (
        <button className="btn secondary block" disabled={busy} onClick={() => addMember(currentTechnician!.id)} style={{ marginBottom: 8 }}>
          Join as team member
        </button>
      )}

      {canManage && !isViewer && addableTechnicians.length > 0 && (
        <div className="field" style={{ marginBottom: 0, marginTop: 8 }}>
          <label>Add team member</label>
          <select value="" disabled={busy} onChange={(e) => addMember(e.target.value)}>
            <option value="">Select technician…</option>
            {addableTechnicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {isDispatcherOrAdmin && !isViewer && (
        <div className="field" style={{ marginBottom: 0, marginTop: 10 }}>
          <label>Change lead</label>
          <select value="" onChange={(e) => e.target.value && onReassignLead(e.target.value)}>
            <option value="">Select technician…</option>
            {allTechnicians
              .filter((t) => t.id !== primaryAssignee?.id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </div>
      )}
    </div>
  );
}
