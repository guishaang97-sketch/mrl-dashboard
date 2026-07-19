"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ResolutionType, RESOLUTION_TYPE_LABELS } from "@/lib/types";

export default function ResolveModal({
  ticketId,
  technicianId,
  onClose,
  onResolved,
}: {
  ticketId: string;
  technicianId: string | undefined;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [resolutionType, setResolutionType] = useState<ResolutionType>("fixed_via_call");
  const [symptomCategory, setSymptomCategory] = useState<"hardware" | "software">("hardware");
  const [errorCode, setErrorCode] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [partsUsed, setPartsUsed] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!rootCause.trim() || !resolutionNotes.trim()) {
      setError("Root cause and resolution notes are required.");
      return;
    }

    setSubmitting(true);

    const { error: resError } = await supabase.from("resolutions").insert({
      ticket_id: ticketId,
      symptom_category: symptomCategory,
      resolution_type: resolutionType,
      error_code: errorCode.trim() || null,
      root_cause: rootCause.trim(),
      resolution_notes: resolutionNotes.trim(),
      parts_used: partsUsed.trim() ? partsUsed.split(",").map((p) => p.trim()).filter(Boolean) : null,
    });

    if (resError) {
      setSubmitting(false);
      setError(resError.message);
      return;
    }

    // The DB trigger requires the resolutions row above to exist before
    // this update to 'resolved' is allowed — it does, since we awaited it.
    const { error: ticketError } = await supabase
      .from("tickets")
      .update({ status: "resolved", last_activity_label: RESOLUTION_TYPE_LABELS[resolutionType] })
      .eq("id", ticketId);

    setSubmitting(false);

    if (ticketError) {
      setError(ticketError.message);
      return;
    }

    const { error: eventError } = await supabase.from("ticket_events").insert({
      ticket_id: ticketId,
      actor: technicianId,
      event_type: "status_change",
      detail: `Resolved — ${RESOLUTION_TYPE_LABELS[resolutionType]}`,
    });
    if (eventError) console.error("Failed to log resolve event:", eventError);

    onResolved();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Resolve ticket</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Outcome</label>
            <select value={resolutionType} onChange={(e) => setResolutionType(e.target.value as ResolutionType)}>
              {Object.entries(RESOLUTION_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Symptom category</label>
            <select value={symptomCategory} onChange={(e) => setSymptomCategory(e.target.value as "hardware" | "software")}>
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
            </select>
          </div>
          <div className="field">
            <label>Error code (optional)</label>
            <input value={errorCode} onChange={(e) => setErrorCode(e.target.value)} placeholder="e.g. E-204" />
          </div>
          <div className="field">
            <label>Root cause</label>
            <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} placeholder="What actually caused the issue?" />
          </div>
          <div className="field">
            <label>Resolution notes</label>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="What was done to fix it?"
            />
          </div>
          <div className="field">
            <label>Parts used (optional, comma-separated)</label>
            <input value={partsUsed} onChange={(e) => setPartsUsed(e.target.value)} placeholder="e.g. fuse-3A, drive belt" />
          </div>
          <button className="btn block" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Mark resolved"}
          </button>
          {error && <div className="msg error">{error}</div>}
        </form>
      </div>
    </div>
  );
}
