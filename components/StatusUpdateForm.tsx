"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { StatusCode, STATUS_CODE_LABELS } from "@/lib/types";

export default function StatusUpdateForm({
  ticketId,
  currentCode,
  technicianId,
  onUpdated,
}: {
  ticketId: string;
  currentCode: StatusCode;
  technicianId: string | undefined;
  onUpdated: () => void;
}) {
  const [code, setCode] = useState<StatusCode>(currentCode);
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg("");

    const codeLabel = code ? STATUS_CODE_LABELS[code] : "Status code cleared";
    const label = remark.trim() ? `${codeLabel} — ${remark.trim()}` : codeLabel;

    const { error } = await supabase
      .from("tickets")
      .update({ status_code: code, last_activity_label: codeLabel })
      .eq("id", ticketId);

    if (!error) {
      const { error: eventError } = await supabase.from("ticket_events").insert({
        ticket_id: ticketId,
        actor: technicianId,
        event_type: "status_code_change",
        detail: label,
      });
      if (eventError) console.error("Failed to log status update event:", eventError);
    }

    setSubmitting(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setRemark("");
    onUpdated();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field" style={{ marginBottom: 10 }}>
        <label>Status update</label>
        <select value={code || ""} onChange={(e) => setCode((e.target.value || null) as StatusCode)}>
          <option value="">—</option>
          {Object.entries(STATUS_CODE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ marginBottom: 10 }}>
        <label>Remark (optional)</label>
        <textarea
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="e.g. Called customer, no answer, will retry tomorrow"
          style={{ minHeight: 60 }}
        />
      </div>
      <button className="btn secondary block" type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit update"}
      </button>
      {msg && <div className="msg error">{msg}</div>}
    </form>
  );
}

