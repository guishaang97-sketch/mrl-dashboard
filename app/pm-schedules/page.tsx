"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import PmContractModal from "@/components/PmContractModal";
import { PmContract, PmSchedule, PM_VISIT_STATUS_LABELS } from "@/lib/types";

function ContractCard({ contract, nextDate, onChange }: { contract: PmContract; nextDate: string | null; onChange: () => void }) {
  const { technician } = useAuth();
  const isAdmin = technician?.role === "admin";
  const isDispatcherOrAdmin = technician?.role === "dispatcher" || technician?.role === "admin";

  const [expanded, setExpanded] = useState(false);
  const [visits, setVisits] = useState<PmSchedule[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadVisits() {
    setLoadingVisits(true);
    const { data } = await supabase
      .from("pm_schedules")
      .select("*")
      .eq("pm_contract_id", contract.id)
      .order("scheduled_date");
    setVisits((data as PmSchedule[]) || []);
    setLoadingVisits(false);
  }

  function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && visits.length === 0) loadVisits();
  }

  async function markComplete(visitId: string) {
    setBusy(true);
    await supabase.from("pm_schedules").update({ status: "completed" }).eq("id", visitId);
    setBusy(false);
    loadVisits();
  }

  async function handleTerminate() {
    const reason = prompt("Reason for terminating this PM contract early? (required)");
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    setMsg("");
    const { error } = await supabase.rpc("terminate_pm_contract", { p_contract_id: contract.id, p_reason: reason.trim() });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    onChange();
  }

  async function handleReactivate() {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.rpc("reactivate_pm_contract", { p_contract_id: contract.id });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    onChange();
  }

  const m = contract.machines;

  return (
    <div className="card" style={{ marginBottom: 10, opacity: contract.status === "terminated" ? 0.65 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", cursor: "pointer" }} onClick={handleExpand}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>
            {contract.focus}
            {contract.status === "terminated" && <span className="badge closed" style={{ marginLeft: 6 }}>Terminated</span>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
            {m ? `${m.customer_name} — ${m.brand} ${m.machine_model} (SN ${m.serial_number})` : "Machine"}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
            Every {contract.interval_months} month{contract.interval_months > 1 ? "s" : ""} · Next:{" "}
            {nextDate ? new Date(nextDate).toLocaleDateString() : "All visits done"}
          </div>
        </div>
        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {contract.status === "terminated" && contract.termination_reason && (
        <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>
          Terminated: {contract.termination_reason}
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
          {loadingVisits && <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>Loading visits…</div>}
          {!loadingVisits && (
            <div className="events" style={{ marginBottom: 12 }}>
              {visits.map((v) => (
                <div key={v.id} className="event-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div>{new Date(v.scheduled_date).toLocaleDateString()}</div>
                    <div className="event-meta">{PM_VISIT_STATUS_LABELS[v.status]}</div>
                  </div>
                  {isDispatcherOrAdmin && v.status !== "completed" && v.status !== "cancelled" && (
                    <button className="btn small secondary" disabled={busy} onClick={() => markComplete(v.id)}>
                      Mark complete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isAdmin && (
            <div style={{ display: "flex", gap: 8 }}>
              {contract.status === "active" && (
                <button className="btn secondary" disabled={busy} onClick={handleTerminate}>
                  Terminate contract
                </button>
              )}
              {contract.status === "terminated" && (
                <button className="btn secondary" disabled={busy} onClick={handleReactivate}>
                  Reactivate
                </button>
              )}
            </div>
          )}
          {msg && <div className="msg error">{msg}</div>}
        </div>
      )}
    </div>
  );
}

function PmSchedulesContent() {
  const { technician } = useAuth();
  const isDispatcherOrAdmin = technician?.role === "dispatcher" || technician?.role === "admin";
  const allowed = !!technician && technician.role !== "viewer";

  const [contracts, setContracts] = useState<PmContract[]>([]);
  const [nextDates, setNextDates] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"active" | "terminated" | "all">("active");
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    let query = supabase.from("pm_contracts").select("*, machines(*)").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data, error } = await query;
    const list = (data as unknown as PmContract[]) || [];
    if (!error) setContracts(list);

    // One extra query gets the next uncompleted visit date for every
    // contract at once, instead of a per-card round trip.
    if (list.length > 0) {
      const { data: upcoming } = await supabase
        .from("pm_schedules")
        .select("pm_contract_id, scheduled_date")
        .in("pm_contract_id", list.map((c) => c.id))
        .not("status", "in", "(completed,cancelled)")
        .order("scheduled_date", { ascending: true });

      const map = new Map<string, string>();
      for (const v of upcoming || []) {
        if (!map.has(v.pm_contract_id)) map.set(v.pm_contract_id, v.scheduled_date);
      }
      setNextDates(map);
    } else {
      setNextDates(new Map());
    }

    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    if (allowed) load();
  }, [load, allowed]);

  if (technician && !allowed) {
    return (
      <div className="container">
        <div className="empty-state">This page isn't available for your role.</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="board-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>PM schedules</h1>
        {isDispatcherOrAdmin && (
          <button className="btn" onClick={() => setShowModal(true)}>
            New PM contract
          </button>
        )}
      </div>

      <div className="tabs">
        <button className={`tab ${statusFilter === "active" ? "active" : ""}`} onClick={() => setStatusFilter("active")}>
          Active
        </button>
        <button className={`tab ${statusFilter === "terminated" ? "active" : ""}`} onClick={() => setStatusFilter("terminated")}>
          Terminated
        </button>
        <button className={`tab ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>
          All
        </button>
      </div>

      {loading && <div className="empty-state">Loading…</div>}
      {!loading && contracts.length === 0 && <div className="empty-state">No PM contracts here yet.</div>}

      <div className="board-grid" style={{ alignItems: "start" }}>
        {contracts.map((c) => (
          <ContractCard key={c.id} contract={c} nextDate={nextDates.get(c.id) || null} onChange={load} />
        ))}
      </div>

      {showModal && (
        <PmContractModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

export default function PmSchedulesPage() {
  return (
    <RequireAuth>
      <PmSchedulesContent />
    </RequireAuth>
  );
}
