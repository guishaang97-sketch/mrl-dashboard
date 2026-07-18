"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import StatusBadge from "@/components/StatusBadge";
import StatusUpdateForm from "@/components/StatusUpdateForm";
import TeamPanel from "@/components/TeamPanel";
import ResolveModal from "@/components/ResolveModal";
import { Ticket, TicketEvent, Resolution, Technician, RESOLUTION_TYPE_LABELS } from "@/lib/types";

function DetailContent() {
  const params = useParams();
  const ticketId = params?.id as string;
  const { technician } = useAuth();
  const isViewer = technician?.role === "viewer";
  const isDispatcherOrAdmin = technician?.role === "dispatcher" || technician?.role === "admin";

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ technician_id: string; technicians: Pick<Technician, "id" | "name"> }[]>([]);
  const [allTechnicians, setAllTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showResolveModal, setShowResolveModal] = useState(false);

  const isAssignedToMe = !!technician && ticket?.assigned_to === technician.id;
  const isOnTeam = !!technician && teamMembers.some((m) => m.technician_id === technician.id);
  const canManage = !isViewer && (isDispatcherOrAdmin || isAssignedToMe || isOnTeam);

  const load = useCallback(async () => {
    const [ticketRes, eventsRes, resolutionRes, assigneesRes] = await Promise.all([
      supabase.from("tickets").select("*, machines(*), technicians!tickets_assigned_to_fkey(*)").eq("id", ticketId).single(),
      supabase
        .from("ticket_events")
        .select("*, technicians(name)")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false }),
      supabase.from("resolutions").select("*").eq("ticket_id", ticketId).maybeSingle(),
      supabase.from("ticket_assignees").select("technician_id, technicians(id, name)").eq("ticket_id", ticketId),
    ]);

    if (ticketRes.error) {
      setMsg("Could not load this ticket.");
      setLoading(false);
      return;
    }

    setTicket(ticketRes.data as unknown as Ticket);
    setEvents((eventsRes.data as unknown as TicketEvent[]) || []);
    setResolution((resolutionRes.data as unknown as Resolution) || null);
    setTeamMembers((assigneesRes.data as unknown as typeof teamMembers) || []);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    load();
    supabase
      .from("technicians")
      .select("*")
      .eq("active", true)
      .then(({ data }) => setAllTechnicians((data as Technician[]) || []));
  }, [load]);

  async function logEvent(eventType: TicketEvent["event_type"], detail: string) {
    await supabase.from("ticket_events").insert({
      ticket_id: ticketId,
      actor: technician?.id,
      event_type: eventType,
      detail,
    });
  }

  async function handleClaim() {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.rpc("claim_ticket", { p_ticket_id: ticketId });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    load();
  }

  async function handleStartWork() {
    setBusy(true);
    const { error } = await supabase
      .from("tickets")
      .update({ status: "in_progress", last_activity_label: "Started work" })
      .eq("id", ticketId);
    if (!error) await logEvent("status_change", "Marked in progress");
    setBusy(false);
    load();
  }

  async function handleReassignLead(newTechId: string) {
    setBusy(true);
    const { error } = await supabase
      .from("tickets")
      .update({
        assigned_to: newTechId,
        status: "claimed",
        claimed_at: new Date().toISOString(),
        last_activity_label: "Lead reassigned",
      })
      .eq("id", ticketId);
    if (!error) {
      const t = allTechnicians.find((t) => t.id === newTechId);
      await logEvent("reassigned", `Lead reassigned to ${t?.name || newTechId}`);
    }
    setBusy(false);
    load();
  }

  async function handleClose() {
    setBusy(true);
    const { error } = await supabase
      .from("tickets")
      .update({ status: "closed", last_activity_label: "Closed" })
      .eq("id", ticketId);
    if (!error) await logEvent("status_change", "Closed");
    setBusy(false);
    load();
  }

  async function handleReopen() {
    setBusy(true);
    const nextStatus = ticket?.assigned_to ? "in_progress" : "unclaimed";
    const { error } = await supabase
      .from("tickets")
      .update({ status: nextStatus, last_activity_label: "Reopened" })
      .eq("id", ticketId);
    if (!error) await logEvent("status_change", "Reopened");
    setBusy(false);
    load();
  }

  if (loading) {
    return (
      <div className="container">
        <div className="empty-state">Loading…</div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="container">
        <div className="empty-state">{msg || "Ticket not found."}</div>
      </div>
    );
  }

  const m = ticket.machines!;

  return (
    <div className="container">
      <Link href="/board" className="back-link">
        ← Back to board
      </Link>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, gap: 10 }}>
        <div>
          <h1 className="detail-title">{ticket.ticket_number}</h1>
          <div className="detail-sub">
            {m.customer_name} — {m.brand} {m.machine_model}
          </div>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      {msg && <div className="msg error">{msg}</div>}

      <div className="detail-grid">
        <div>
          <div className="card">
            <div className="section-title" style={{ marginTop: 0 }}>
              Machine
            </div>
            <div className="info-grid">
              <div className="info-item">
                <div className="label">Customer</div>
                <div className="value">{m.customer_name}</div>
              </div>
              <div className="info-item">
                <div className="label">Region</div>
                <div className="value">{m.region}</div>
              </div>
              <div className="info-item">
                <div className="label">Brand</div>
                <div className="value">{m.brand}</div>
              </div>
              <div className="info-item">
                <div className="label">Machine</div>
                <div className="value">{m.machine_model}</div>
              </div>
              <div className="info-item">
                <div className="label">Serial</div>
                <div className="value mono">{m.serial_number}</div>
              </div>
              <div className="info-item">
                <div className="label">Type</div>
                <div className="value">{m.contract_type || "—"}</div>
              </div>
              <div className="info-item">
                <div className="label">Validity</div>
                <div className="value">{m.contract_validity || "—"}</div>
              </div>
            </div>

            <div className="section-title">Reported Issue</div>
            <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>{ticket.description || "—"}</p>

            <div className="section-title">Contact</div>
            <div className="info-grid">
              <div className="info-item">
                <div className="label">Name</div>
                <div className="value">{ticket.contact_name || "—"}</div>
              </div>
              <div className="info-item">
                <div className="label">Number</div>
                <div className="value">{ticket.contact_number || "—"}</div>
              </div>
              <div className="info-item">
                <div className="label">Email</div>
                <div className="value">{ticket.contact_email || "—"}</div>
              </div>
            </div>

            <div className="section-title">Timeline</div>
            <div className="info-grid">
              <div className="info-item">
                <div className="label">Ticket lodged</div>
                <div className="value">{new Date(ticket.created_at).toLocaleString()}</div>
              </div>
              <div className="info-item">
                <div className="label">Last update</div>
                <div className="value">
                  {ticket.last_activity_label} · {new Date(ticket.last_activity_at).toLocaleString()}
                </div>
              </div>
            </div>

            {resolution && (
              <>
                <div className="section-title">Resolution</div>
                <div className="info-grid">
                  <div className="info-item">
                    <div className="label">Outcome</div>
                    <div className="value">{RESOLUTION_TYPE_LABELS[resolution.resolution_type]}</div>
                  </div>
                  <div className="info-item">
                    <div className="label">Symptom</div>
                    <div className="value">{resolution.symptom_category}</div>
                  </div>
                  <div className="info-item">
                    <div className="label">Error Code</div>
                    <div className="value">{resolution.error_code || "—"}</div>
                  </div>
                  <div className="info-item" style={{ gridColumn: "1 / -1" }}>
                    <div className="label">Root Cause</div>
                    <div className="value">{resolution.root_cause}</div>
                  </div>
                  <div className="info-item" style={{ gridColumn: "1 / -1" }}>
                    <div className="label">Resolution Notes</div>
                    <div className="value">{resolution.resolution_notes}</div>
                  </div>
                  {resolution.parts_used && resolution.parts_used.length > 0 && (
                    <div className="info-item" style={{ gridColumn: "1 / -1" }}>
                      <div className="label">Parts Used</div>
                      <div className="value">{resolution.parts_used.join(", ")}</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="section-title">History</div>
          <div className="card" style={{ padding: "6px 20px" }}>
            {events.length === 0 && <div className="empty-state" style={{ padding: "20px 0" }}>No events yet.</div>}
            <div className="events">
              {events.map((ev) => (
                <div key={ev.id} className="event-row">
                  <div>{ev.detail || ev.event_type}</div>
                  <div className="event-meta">
                    {ev.technicians?.name || "Customer"} · {new Date(ev.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          {ticket.status === "unclaimed" && !isViewer && (
            <div className="card" style={{ marginBottom: 14 }}>
              <button className="btn block" onClick={handleClaim} disabled={busy}>
                {busy ? "Claiming…" : "Claim this ticket"}
              </button>
            </div>
          )}

          {ticket.status !== "unclaimed" && (
            <TeamPanel
              ticketId={ticketId}
              primaryAssignee={ticket.technicians || null}
              teamMembers={teamMembers}
              allTechnicians={allTechnicians}
              currentTechnician={technician}
              canManage={canManage}
              isDispatcherOrAdmin={isDispatcherOrAdmin}
              isViewer={isViewer}
              onChange={load}
              onReassignLead={handleReassignLead}
            />
          )}

          {canManage && (ticket.status === "claimed" || ticket.status === "in_progress") && (
            <div className="card" style={{ marginBottom: 14 }}>
              {ticket.status === "claimed" && (
                <button className="btn block" onClick={handleStartWork} disabled={busy} style={{ marginBottom: 14 }}>
                  Start work
                </button>
              )}
              <StatusUpdateForm ticketId={ticketId} currentCode={ticket.status_code} onUpdated={load} />
            </div>
          )}

          {canManage && (ticket.status === "claimed" || ticket.status === "in_progress") && !resolution && (
            <div className="card" style={{ marginBottom: 14 }}>
              <button className="btn block" onClick={() => setShowResolveModal(true)}>
                Resolve ticket
              </button>
            </div>
          )}

          {canManage && ticket.status === "resolved" && (
            <div className="card">
              <button className="btn secondary block" onClick={handleClose} disabled={busy}>
                Close ticket
              </button>
            </div>
          )}

          {isDispatcherOrAdmin && ticket.status === "closed" && (
            <div className="card">
              <button className="btn secondary block" onClick={handleReopen} disabled={busy}>
                {busy ? "Reopening…" : "Reopen ticket"}
              </button>
            </div>
          )}
        </div>
      </div>

      {showResolveModal && (
        <ResolveModal
          ticketId={ticketId}
          onClose={() => setShowResolveModal(false)}
          onResolved={() => {
            setShowResolveModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

export default function TicketDetailPage() {
  return (
    <RequireAuth>
      <DetailContent />
    </RequireAuth>
  );
}
