"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import StatusBadge from "@/components/StatusBadge";
import PriorityDot from "@/components/PriorityDot";
import { Ticket, REGIONS } from "@/lib/types";

type Tab = "open" | "closed";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function BoardContent() {
  const { technician } = useAuth();
  const isViewer = technician?.role === "viewer";

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("open");
  // Date range for the Closed tab. Filtered against last_activity_at rather
  // than closed_at, since a resolved-but-not-yet-closed ticket has no
  // closed_at yet but still belongs in this tab.
  const [fromDate, setFromDate] = useState<string>(isoDate(new Date(Date.now() - 30 * 86400000)));
  const [toDate, setToDate] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [regionInitialized, setRegionInitialized] = useState(false);
  const [search, setSearch] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  function applyPreset(days: number | null) {
    if (days === null) {
      setFromDate("");
      setToDate("");
      return;
    }
    setFromDate(isoDate(new Date(Date.now() - days * 86400000)));
    setToDate("");
  }

  // Default the region filter to the technician's configured default_region,
  // once, after their profile loads. They can still change it manually.
  useEffect(() => {
    if (!regionInitialized && technician) {
      setRegionFilter(technician.default_region || "all");
      setRegionInitialized(true);
    }
  }, [technician, regionInitialized]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("tickets")
      .select("*, machines(*), technicians!tickets_assigned_to_fkey(*), ticket_assignees(technician_id, technicians(id, name))")
      .order("last_activity_at", { ascending: false })
      .limit(300);

    if (tab === "open") {
      query = query.in("status", ["unclaimed", "claimed", "in_progress"]);
    } else {
      query = query.in("status", ["resolved", "closed"]);
      if (fromDate) query = query.gte("last_activity_at", `${fromDate}T00:00:00`);
      if (toDate) query = query.lte("last_activity_at", `${toDate}T23:59:59`);
    }
    if (regionFilter !== "all") query = query.eq("region", regionFilter);

    const { data, error } = await query;
    if (error) {
      console.error(error);
      setMsg("Could not load tickets.");
      setLoading(false);
      return;
    }
    setTickets((data as unknown as Ticket[]) || []);
    setLoading(false);
  }, [tab, fromDate, toDate, regionFilter]);

  useEffect(() => {
    fetchTickets();
    const channel = supabase
      .channel("tickets-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => fetchTickets())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTickets]);

  async function handleClaim(ticketId: string) {
    setClaimingId(ticketId);
    setMsg("");
    const { error } = await supabase.rpc("claim_ticket", { p_ticket_id: ticketId });
    setClaimingId(null);
    if (error) {
      setMsg(error.message.includes("no longer unclaimed") ? "Someone else just claimed this ticket." : error.message);
      fetchTickets();
      return;
    }
    fetchTickets();
  }

  const filtered = useMemo(() => {
    let rows = tickets.filter((t) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        t.ticket_number.toLowerCase().includes(q) ||
        t.machines?.customer_name?.toLowerCase().includes(q) ||
        t.machines?.serial_number?.toLowerCase().includes(q) ||
        t.machines?.machine_model?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    });

    // On the Open tab, pin "assigned to me" tickets to the top — everything
    // else keeps its last-activity ordering from the query.
    if (tab === "open" && technician) {
      const mine = rows.filter(
        (t) => t.assigned_to === technician.id || (t.ticket_assignees || []).some((a) => a.technician_id === technician.id),
      );
      const rest = rows.filter(
        (t) => !(t.assigned_to === technician.id || (t.ticket_assignees || []).some((a) => a.technician_id === technician.id)),
      );
      rows = [...mine, ...rest];
    }

    return rows;
  }, [tickets, search, tab, technician]);

  return (
    <div className="container">
      <div className="board-header">
        <h1>Tickets</h1>
        <span className="board-count">{loading ? "Loading…" : `${filtered.length} shown`}</span>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "open" ? "active" : ""}`} onClick={() => setTab("open")}>
          Open
        </button>
        <button className={`tab ${tab === "closed" ? "active" : ""}`} onClick={() => setTab("closed")}>
          Closed
        </button>
      </div>

      <div className="filters">
        <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
          <option value="all">All regions</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {tab === "closed" && (
          <>
            <button className="btn small secondary" type="button" onClick={() => applyPreset(30)}>
              30 days
            </button>
            <button className="btn small secondary" type="button" onClick={() => applyPreset(182)}>
              6 months
            </button>
            <button className="btn small secondary" type="button" onClick={() => applyPreset(365)}>
              1 year
            </button>
            <button className="btn small secondary" type="button" onClick={() => applyPreset(null)}>
              All
            </button>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" />
          </>
        )}
        <input
          type="text"
          placeholder="Search ticket #, customer, serial, model…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {msg && <div className="msg error" style={{ marginBottom: 14 }}>{msg}</div>}

      {!loading && filtered.length === 0 && <div className="empty-state">No tickets match these filters.</div>}

      <div className="board-grid">
        {filtered.map((t) => {
          const teamNames = (t.ticket_assignees || []).map((a) => a.technicians.name);
          const isMine =
            !!technician &&
            (t.assigned_to === technician.id || (t.ticket_assignees || []).some((a) => a.technician_id === technician.id));
          return (
            <Link href={`/tickets/${t.id}`} key={t.id} className="ticket-card">
              <div className="tc-top">
                <div className="tc-id">
                  <PriorityDot status={t.status} />
                  <span className="ticket-number">{t.ticket_number}</span>
                  {isMine && tab === "open" && (
                    <span title="Assigned to you" aria-label="Assigned to you">
                      📌
                    </span>
                  )}
                </div>
                <StatusBadge status={t.status} />
              </div>

              <div>
                <div className="tc-title">
                  {t.machines?.customer_name} — {t.machines?.brand} {t.machines?.machine_model}
                </div>
                <div className="tc-sub">
                  SN {t.machines?.serial_number}
                  {t.technicians?.name ? ` · ${t.technicians.name}` : ""}
                  {teamNames.length > 0 ? ` +${teamNames.length}` : ""}
                </div>
              </div>

              <div className="tc-meta">
                <div>
                  Lodged: <b>{new Date(t.created_at).toLocaleString()}</b>
                </div>
                <div>
                  Last update: <b>{t.last_activity_label}</b> · {timeAgo(t.last_activity_at)}
                </div>
              </div>

              <div className="tc-bottom">
                <span className="ticket-region">{t.region}</span>
                {t.status === "unclaimed" && !isViewer && (
                  <button
                    className="btn small"
                    disabled={claimingId === t.id}
                    onClick={(e) => {
                      e.preventDefault();
                      handleClaim(t.id);
                    }}
                  >
                    {claimingId === t.id ? "Claiming…" : "Claim"}
                  </button>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function BoardPage() {
  return (
    <RequireAuth>
      <BoardContent />
    </RequireAuth>
  );
}
