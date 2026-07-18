import { STATUS_DOT, TicketStatus } from "@/lib/types";

export default function PriorityDot({ status }: { status: TicketStatus }) {
  return (
    <span
      className="priority-dot"
      style={{ background: STATUS_DOT[status] }}
      title={status}
      aria-label={`Status: ${status}`}
    />
  );
}
