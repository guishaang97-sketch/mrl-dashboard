"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import StatusBadge from "@/components/StatusBadge";
import PriorityDot from "@/components/PriorityDot";
import { Ticket, REGIONS } from "@/lib/types";

type Tab = "open" | "closed";

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
  // Closed tab is search-gated, same idea as the knowledge base: don't
  // auto-load everything, wait for a search or an explicit "browse" click.
  const [hasSearchedClosed, setHasSearchedClosed] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [regionInitialized, setRegionInitialized] = useState(false);
  const [search, setSearch] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      .limit(tab === "open" ? 300 : 200);

    if (tab === "open") {
      query = query.in("status", ["unclaimed", "claimed", "in_progress"]);
    } else {
      query = query.in("status", ["resolved", "closed"]);
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
  }, [tab, regionFilter]);

  // Open tab: load automatically, same as always. Closed tab: only once
  // the user has actually searched or clicked "browse" — see below.
  useEffect(() => {
    if (tab === "open") {
      fetchTickets();
    } else if (tab === "closed" && hasSearchedClosed) {
      fetchTickets();
    } else {
      setLoading(false);
    }
  }, [tab, regionFilter, hasSearchedClosed, fetchTickets]);

  // Leaving the Closed tab resets its gate — next visit starts fresh
  // rather than silently holding onto a possibly-stale list.
  function switchTab(next: Tab) {
    if (tab === "closed" && next !== "closed") {
      setHasSearchedClosed(false);
      setTickets([]);
    }
    setSearch("");
    setTab(next);
  }

  function handleClosedSearchInput(q: string) {
    setSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 4) return;
    searchTimer.current = setTimeout(() => setHasSearchedClosed(true), 300);
  }

  // Whether a single ticket belongs in the currently-viewed tab/filters —
  // used so a realtime update can decide "add/update this row" vs "it
  // moved out of view, remove it" without re-querying the whole board.
  const belongsInCurrentView = useCallback(
    (t: Ticket) => {
      const openStatuses = ["unclaimed", "claimed", "in_progress"];
      const closedStatuses = ["resolved", "closed"];
      if (tab === "open" && !openStatuses.includes(t.status)) return false;
      if (tab === "closed" && (!hasSearchedClosed || !closedStatuses.includes(t.status))) return false;
      if (regionFilter !== "all" && t.region !== regionFilter) return false;
      return true;
    },
    [tab, hasSearchedClosed, regionFilter],
  );

  // Realtime handler: instead of re-running the full board query on every
  // change (expensive — every open tab re-downloads the entire list),
  // fetch just the ONE changed ticket and merge it into local state. Much
  // smaller payload per event, and scales with number of changes rather
  // than (changes × open tabs × full list size).
  const applyRealtimeChange = useCallback(
    async (payload: { eventType: string; new: { id?: string }; old: { id?: string } }) => {
      if (payload.eventType === "DELETE") {
        const deletedId = payload.old?.id;
        if (deletedId) setTickets((prev) => prev.filter((t) => t.id !== deletedId));
        return;
      }

      const id = payload.new?.id;
      if (!id) return;

      const { data, error } = await supabase
        .from("tickets")
        .select("*, machines(*), technicians!tickets_assigned_to_fkey(*), ticket_assignees(technician_id, technicians(id, name))")
        .eq("id", id)
        .maybeSingle();

      if (error || !data) return;
      const updated = data as unknown as Ticket;

      setTickets((prev) => {
        const withoutThis = prev.filter((t) => t.id !== updated.id);
        const next = belongsInCurrentView(updated) ? [updated, ...withoutThis] : withoutThis;
        return next.sort((a, b) => (a.last_activity_at < b.last_activity_at ? 1 : -1));
      });
    },
    [belongsInCurrentView],
  );

  useEffect(() => {
    const channel = supabase
      .channel("tickets-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, (payload) =>
        applyRealtimeChange(payload as never),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [applyRealtimeChange]);

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
        {(tab === "open" || hasSearchedClosed) && (
          <span className="board-count">{loading ? "Loading…" : `${filtered.length} shown`}</span>
        )}
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "open" ? "active" : ""}`} onClick={() => switchTab("open")}>
          Open
        </button>
        <button className={`tab ${tab === "closed" ? "active" : ""}`} onClick={() => switchTab("closed")}>
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
        <input
          type="text"
          placeholder={
            tab === "closed"
              ? "Search ticket #, customer, serial, model… (4+ letters)"
              : "Search ticket #, customer, serial, model…"
          }
          value={search}
          onChange={(e) => (tab === "closed" ? handleClosedSearchInput(e.target.value) : setSearch(e.target.value))}
        />
        {tab === "closed" && !hasSearchedClosed && (
          <button className="btn secondary" onClick={() => setHasSearchedClosed(true)}>
            Browse recent closed/resolved
          </button>
        )}
      </div>

      {msg && <div className="msg error" style={{ marginBottom: 14 }}>{msg}</div>}

      {tab === "closed" && !hasSearchedClosed && (
        <div className="empty-state">Search for something specific, or click "Browse recent closed/resolved" to see the latest 200.</div>
      )}
      {(tab === "open" || hasSearchedClosed) && !loading && filtered.length === 0 && (
        <div className="empty-state">No tickets match these filters.</div>
      )}

      <div className="board-grid">
        {(tab === "open" || hasSearchedClosed) &&
          filtered.map((t) => {
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
