"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ResolutionForm({
  ticketId,
  onResolved,
}: {
  ticketId: string;
  onResolved: () => void;
}) {
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

    // The DB trigger requires a resolutions row to exist before this
    // update to 'resolved' is allowed to succeed — insert above must
    // land first, which it does since we await it.
    const { error: ticketError } = await supabase
      .from("tickets")
      .update({ status: "resolved" })
      .eq("id", ticketId);

    setSubmitting(false);

    if (ticketError) {
      setError(ticketError.message);
      return;
    }

    onResolved();
  }

  return (
    <form onSubmit={handleSubmit}>
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
  );
}
