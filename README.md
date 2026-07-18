# MRL Cybertec — Service Dashboard

Next.js technician dashboard: login, ticket board with filters, claim/
reassign, status codes, resolution capture, full audit history per ticket.
Realtime — the board updates live across everyone viewing it, no refresh
needed.

## 1. Local setup

```bash
cd mrl-dashboard
npm install
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase project's URL and **anon** key (NOT
the service role key — this runs in the browser) from Supabase dashboard →
Settings → API.

```bash
npm run dev
```

Open http://localhost:3000 — you'll land on `/login`.

## 2. Create your first account (do this before logging in)

There's no self-signup by design (staff-only tool). Create your own admin
account manually, once:

1. Supabase dashboard → **Authentication → Users → Add user**. Set an
   email and password, and toggle **Auto Confirm User** on (skips email
   verification).
2. Copy the new user's UUID from that same screen.
3. Supabase dashboard → **SQL Editor**, run (replace both placeholders):

```sql
insert into technicians (id, name, email, role)
values ('<paste-the-user-uuid>', 'Your Name', 'your@email.com', 'admin');
```

Now sign in with that email/password on `/login`. Repeat this two-step
process (Auth user + `technicians` row) for every technician/dispatcher —
same manual process you mentioned doing later for the roster.

## 3. What's in the dashboard

- **`/board`** — all tickets, filterable by status/region, free-text
  search across ticket number/customer/serial/model/description.
  Unclaimed tickets show a **Claim** button right on the row (uses the
  atomic `claim_ticket` RPC from the schema — no race conditions if two
  people click at once).
- **`/tickets/[id]`** — full detail: machine info, reported issue,
  contact info, resolution (once filled in), and complete history.
  - **Technicians** see claim + status controls only for tickets assigned
    to them.
  - **Dispatchers/admins** see those controls for every ticket, plus a
    **reassign** dropdown.
  - The **resolve** form is the structured capture from the schema
    (symptom category, error code, root cause, notes, parts used) — the
    database itself blocks marking a ticket resolved without this, so the
    dashboard just surfaces that requirement as a form instead of letting
    it fail silently.

## 4. Deploy (free)

[Vercel](https://vercel.com) free tier is the natural fit for Next.js.

1. Push this folder to a GitHub repo.
2. On vercel.com → **Add New Project** → import that repo.
3. In the project's **Environment Variables**, add the same two values
   from `.env.local`.
4. Deploy. You'll get a URL like `mrl-dashboard.vercel.app`.

No server to manage, no cost at this scale.

## 5. Not in this build yet

- Web push / email notifications on new or escalated tickets (the
  `notify-new-ticket` piece — separate build).
- PM schedule views (table already exists in the DB from Phase 3 of the
  schema, just no UI yet).
- PDF service report generation/download from a ticket.
- SLA escalation display (the `escalation_deadline` column is populated by
  the intake function already; the dashboard doesn't surface a countdown
  or highlight overdue tickets yet — worth adding once the notification
  piece exists, since they're closely related).
