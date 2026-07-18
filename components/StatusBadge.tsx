import { STATUS_LABELS, TicketStatus } from "@/lib/types";

export default function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge ${status}`}>{STATUS_LABELS[status]}</span>;
}
