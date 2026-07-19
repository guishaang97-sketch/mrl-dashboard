"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import { KnowledgeBaseEntry, RESOLUTION_TYPE_LABELS } from "@/lib/types";

// Simple in-memory cache, module-scoped so it survives client-side
// navigation away from and back to this page (Next.js doesn't reload JS
// modules on soft navigation). Resets naturally on a full page reload or
// tab close — no server cost either way, and it means "search once,
// browse away, come back" doesn't cost a second query.
let kbCache: { entries: KnowledgeBaseEntry[]; lastQuery: string } | null = null;

function KnowledgeBaseContent() {
  const { technician } = useAuth();
  const allowed = !!technician && (technician.role === "admin" || technician.role === "technician");

  const [entries, setEntries] = useState<KnowledgeBaseEntry[]>(kbCache?.entries || []);
  const [hasSearched, setHasSearched] = useState(!!kbCache);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(kbCache?.lastQuery || "");
  const [symptomFilter, setSymptomFilter] = useState("all");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (technician && !allowed) {
    return (
      <div className="container">
        <div className="empty-state">This page isn't available for your role.</div>
      </div>
    );
  }

  async function runQuery(q: string) {
    setLoading(true);
    let query = supabase.from("knowledge_base").select("*").order("resolved_at", { ascending: false }).limit(200);
    if (q.trim()) {
      const term = `%${q.trim()}%`;
      query = query.or(
        `brand.ilike.${term},machine_model.ilike.${term},error_code.ilike.${term},root_cause.ilike.${term},resolution_notes.ilike.${term}`,
      );
    }
    const { data, error } = await query;
    const results = (data as KnowledgeBaseEntry[]) || [];
    if (!error) {
      setEntries(results);
      kbCache = { entries: results, lastQuery: q };
    }
    setHasSearched(true);
    setLoading(false);
  }

  function handleSearchInput(q: string) {
    setSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 4) return;
    searchTimer.current = setTimeout(() => runQuery(q), 300);
  }

  const brands = useMemo(() => Array.from(new Set(entries.map((e) => e.brand))).sort(), [entries]);

  const filtered = useMemo(() => {
    if (symptomFilter === "all") return entries;
    return entries.filter((e) => e.symptom_category === symptomFilter);
  }, [entries, symptomFilter]);

  return (
    <div className="container">
      <div className="board-header">
        <h1>Knowledge base</h1>
        {hasSearched && <span className="board-count">{loading ? "Loading…" : `${filtered.length} shown`}</span>}
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: -8, marginBottom: 16 }}>
        Every resolved ticket's fix, searchable — for "have we seen this before?"
      </p>

      <div className="filters">
        <select value={symptomFilter} onChange={(e) => setSymptomFilter(e.target.value)}>
          <option value="all">Hardware & software</option>
          <option value="hardware">Hardware</option>
          <option value="software">Software</option>
        </select>
        <input
          type="text"
          placeholder="Search brand, model, error code, root cause… (4+ letters)"
          value={search}
          onChange={(e) => handleSearchInput(e.target.value)}
        />
        {!hasSearched && (
          <button className="btn secondary" onClick={() => runQuery("")}>
            Browse recent fixes
          </button>
        )}
      </div>

      {!hasSearched && (
        <div className="empty-state">Search for something specific, or click "Browse recent fixes" to see the latest 200.</div>
      )}
      {hasSearched && !loading && filtered.length === 0 && <div className="empty-state">No matching resolutions.</div>}

      {brands.length > 0 && (
        <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 10 }}>
          Brands in this result set: {brands.join(", ")}
        </div>
      )}

      <div className="board-grid">
        {filtered.map((e) => (
          <Link href={`/tickets/${e.ticket_id}`} key={e.resolution_id} className="ticket-card">
            <div className="tc-top">
              <div className="tc-id">
                <span className="ticket-number">{e.ticket_number}</span>
              </div>
              <span className="ticket-region">{e.symptom_category}</span>
            </div>

            <div>
              <div className="tc-title">
                {e.brand} {e.machine_model}
              </div>
              <div className="tc-sub">
                {e.error_code ? `Error ${e.error_code} · ` : ""}
                {RESOLUTION_TYPE_LABELS[e.resolution_type]}
              </div>
            </div>

            <div className="tc-meta" style={{ gap: 6 }}>
              <div>
                <b>Root cause:</b> {e.root_cause}
              </div>
              <div>
                <b>Fix:</b> {e.resolution_notes}
              </div>
              {e.parts_used && e.parts_used.length > 0 && (
                <div>
                  <b>Parts:</b> {e.parts_used.join(", ")}
                </div>
              )}
            </div>

            <div className="tc-bottom">
              <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
                {e.resolved_at ? new Date(e.resolved_at).toLocaleDateString() : ""}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function KnowledgeBasePage() {
  return (
    <RequireAuth>
      <KnowledgeBaseContent />
    </RequireAuth>
  );
}
