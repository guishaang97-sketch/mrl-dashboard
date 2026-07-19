"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Machine } from "@/lib/types";

interface MachineResult extends Machine {
  pmCount?: number;
}

export default function PmContractModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MachineResult[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [focus, setFocus] = useState("");
  const [intervalMonths, setIntervalMonths] = useState(3);
  const [firstPmDate, setFirstPmDate] = useState(new Date().toISOString().slice(0, 10));
  const [totalVisits, setTotalVisits] = useState(4);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchInput(q: string) {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 4) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("machines")
        .select("*")
        .eq("active", true)
        .or(`customer_name.ilike.%${q}%,serial_number.ilike.%${q}%,brand.ilike.%${q}%,machine_model.ilike.%${q}%`)
        .limit(10);
      const machines = (data as Machine[]) || [];
      setResults(machines);

      // PM contract counts per result — one extra small query, not worth
      // skipping since it's a single request for the whole result set.
      if (machines.length > 0) {
        const { data: contracts } = await supabase
          .from("pm_contracts")
          .select("machine_id")
          .in("machine_id", machines.map((m) => m.id))
          .eq("status", "active");
        const counts = new Map<string, number>();
        for (const c of contracts || []) {
          counts.set(c.machine_id, (counts.get(c.machine_id) || 0) + 1);
        }
        setResults(machines.map((m) => ({ ...m, pmCount: counts.get(m.id) || 0 })));
      }
    }, 300);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedMachine) {
      setError("Search for and select a machine first.");
      return;
    }
    if (!focus.trim()) {
      setError("Describe what this contract covers (e.g. \"Calibration PM\").");
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from("pm_contracts").insert({
      machine_id: selectedMachine.id,
      focus: focus.trim(),
      interval_months: intervalMonths,
      start_date: firstPmDate,
      total_visits: totalVisits,
      notes: notes.trim() || null,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    onCreated();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New PM contract</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {!selectedMachine ? (
          <div className="field" style={{ position: "relative" }}>
            <label>Find machine</label>
            <input
              type="text"
              placeholder="Search by customer, serial, brand, or model… (4+ characters)"
              value={query}
              onChange={(e) => handleSearchInput(e.target.value)}
              autoFocus
            />
            {results.length > 0 && (
              <div style={{ marginTop: 8, border: "1px solid var(--line)", borderRadius: 8 }}>
                {results.map((m) => (
                  <div
                    key={m.id}
                    className="search-result-item"
                    onClick={() => {
                      setSelectedMachine(m);
                      setResults([]);
                      setQuery("");
                    }}
                  >
                    <div className="sr-name">{m.customer_name}</div>
                    <div className="sr-meta">
                      {m.brand} {m.machine_model} · SN {m.serial_number} · {m.region}
                      {typeof m.pmCount === "number" && m.pmCount > 0 ? ` · ${m.pmCount} active PM contract(s)` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 16, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{selectedMachine.customer_name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                    {selectedMachine.brand} {selectedMachine.machine_model} · SN {selectedMachine.serial_number}
                  </div>
                </div>
                <button className="btn secondary small" type="button" onClick={() => setSelectedMachine(null)}>
                  Change
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Focus</label>
                <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. Calibration PM" />
              </div>
              <div className="field">
                <label>Every how many months? (1–12)</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={intervalMonths}
                  onChange={(e) => setIntervalMonths(Math.min(12, Math.max(1, Number(e.target.value))))}
                />
              </div>
              <div className="field">
                <label>First PM date</label>
                <input type="date" value={firstPmDate} onChange={(e) => setFirstPmDate(e.target.value)} />
              </div>
              <div className="field">
                <label>How many PMs total?</label>
                <input
                  type="number"
                  min={1}
                  value={totalVisits}
                  onChange={(e) => setTotalVisits(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <div className="field">
                <label>Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 14 }}>
                This creates <b>{totalVisits}</b> visit{totalVisits === 1 ? "" : "s"}, every {intervalMonths} month
                {intervalMonths > 1 ? "s" : ""} starting {firstPmDate}.
              </div>
              <button className="btn block" type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create contract"}
              </button>
              {error && <div className="msg error">{error}</div>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
