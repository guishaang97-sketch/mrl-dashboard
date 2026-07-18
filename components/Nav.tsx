"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";

export default function Nav() {
  const { session, technician, signOut } = useAuth();

  if (!session) return null;

  return (
    <div className="nav">
      <div className="nav-inner">
        <Link href="/board" className="nav-brand" style={{ textDecoration: "none" }}>
          <div className="nav-mark">MC</div>
          <div className="nav-title">Service Dashboard</div>
        </Link>
        <div className="nav-right">
          {technician && (
            <>
              <span>{technician.name}</span>
              <span className="role-pill">{technician.role}</span>
            </>
          )}
          <button className="nav-signout" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
