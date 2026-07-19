export type Region = "NCR" | "North" | "South" | "Cebu" | "Davao" | "NSC";

export type ContractType = "parts" | "service" | "parts_and_service" | "rtu" | null;

export type TicketStatus = "unclaimed" | "claimed" | "in_progress" | "resolved" | "closed";

// ============================================================================
// STATUS CODES — shown while a ticket is open (claimed / in progress).
// To change these: edit the two lists below AND the matching enum values in
// the database (db/003_dashboard_v2.sql created `status_code_enum` back in
// 001_schema.sql — adding a new one there needs a migration; renaming a
// *label* only needs a change here).
// ============================================================================
export type StatusCode =
  | "follow_up_call"
  | "requires_personal_visit"
  | "for_parts_ordering"
  | "for_in_office_repair"
  | "service_unit_sent"
  | "unrepairable"
  | null;

export const STATUS_CODE_LABELS: Record<Exclude<StatusCode, null>, string> = {
  follow_up_call: "For follow up call",
  requires_personal_visit: "Requires personal visit",
  for_parts_ordering: "For parts ordering",
  for_in_office_repair: "For pull-out / in-office repair",
  service_unit_sent: "Service unit sent",
  unrepairable: "Unrepairable",
};

// ============================================================================
// RESOLUTION TYPES — asked explicitly when closing out a ticket as resolved.
// ============================================================================
export type ResolutionType = "fixed_via_call" | "visited_and_repaired" | "replacement_sent" | "closed_other";

export const RESOLUTION_TYPE_LABELS: Record<ResolutionType, string> = {
  fixed_via_call: "Fixed via Call",
  visited_and_repaired: "Visited and Repaired",
  replacement_sent: "Replacement Sent",
  closed_other: "Closed (other)",
};

export type TechnicianRole = "technician" | "dispatcher" | "admin" | "viewer";

export interface Technician {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  regions_subscribed: Region[];
  default_region: Region | null;
  role: TechnicianRole;
  active: boolean;
}

export interface Machine {
  id: string;
  qr_short_id: string;
  customer_name: string;
  brand: string;
  machine_model: string;
  serial_number: string;
  region: Region;
  contract_type: ContractType;
  contract_validity: string | null;
  install_date: string | null;
  active?: boolean;
  retired_at?: string | null;
  retired_reason?: string | null;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  machine_id: string;
  status: TicketStatus;
  status_code: StatusCode;
  region: Region;
  assigned_to: string | null;
  claimed_at: string | null;
  description: string | null;
  contact_name: string | null;
  contact_number: string | null;
  contact_email: string | null;
  escalation_deadline: string | null;
  escalated_at: string | null;
  created_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  last_activity_at: string;
  last_activity_label: string;
  machines?: Machine;
  technicians?: Technician | null;
  ticket_assignees?: { technician_id: string; technicians: Pick<Technician, "id" | "name"> }[];
}

export interface TicketEvent {
  id: string;
  ticket_id: string;
  actor: string | null;
  event_type: "claimed" | "status_change" | "status_code_change" | "note" | "reassigned" | "escalated";
  detail: string | null;
  created_at: string;
  technicians?: Pick<Technician, "name"> | null;
}

export interface Resolution {
  id: string;
  ticket_id: string;
  symptom_category: "hardware" | "software";
  resolution_type: ResolutionType;
  error_code: string | null;
  root_cause: string;
  resolution_notes: string;
  parts_used: string[] | null;
  created_at: string;
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  unclaimed: "Unclaimed",
  claimed: "Claimed",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

// Priority-dot colors for the board: red = needs attention (unclaimed),
// amber = in motion (claimed/in progress), green = done.
export const STATUS_DOT: Record<TicketStatus, string> = {
  unclaimed: "#c0433f",
  claimed: "#c78a1f",
  in_progress: "#c78a1f",
  resolved: "#1f8f6f",
  closed: "#8a97a1",
};

export const REGIONS: Region[] = ["NCR", "North", "South", "Cebu", "Davao", "NSC"];

export interface KnowledgeBaseEntry {
  resolution_id: string;
  ticket_id: string;
  ticket_number: string;
  brand: string;
  machine_model: string;
  serial_number: string;
  symptom_category: "hardware" | "software";
  resolution_type: ResolutionType;
  error_code: string | null;
  root_cause: string;
  resolution_notes: string;
  parts_used: string[] | null;
  resolved_at: string | null;
}

export type PmContractStatus = "active" | "terminated" | "completed";

export interface PmContract {
  id: string;
  machine_id: string;
  focus: string;
  interval_months: number;
  start_date: string;
  total_visits: number;
  end_date: string;
  status: PmContractStatus;
  terminated_at: string | null;
  terminated_by: string | null;
  termination_reason: string | null;
  notes: string | null;
  created_at: string;
  machines?: Machine;
}

export type PmVisitStatus = "upcoming" | "notified_week" | "notified_daily" | "completed" | "overdue" | "cancelled";

export const PM_VISIT_STATUS_LABELS: Record<PmVisitStatus, string> = {
  upcoming: "Upcoming",
  notified_week: "Due this week",
  notified_daily: "Due soon",
  completed: "Completed",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export interface PmSchedule {
  id: string;
  machine_id: string;
  pm_contract_id: string | null;
  scheduled_date: string;
  status: PmVisitStatus;
  last_notified_at: string | null;
  notes: string | null;
  created_at: string;
  machines?: Machine;
  pm_contracts?: Pick<PmContract, "focus" | "status">;
}

