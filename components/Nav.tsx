"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";
import PushToggle from "./PushToggle";
import RegionSettingsModal from "./RegionSettingsModal";

export default function Nav() {
  const { session, technician, signOut } = useAuth();
  const [showRegions, setShowRegions] = useState(false);

  if (!session) return null;

  return (
    <div className="nav">
      <div className="nav-inner">
        <Link href="/board" className="nav-brand" style={{ textDecoration: "none" }}>
          <img src="/logo-icon.png" alt="MRL Cybertec" style={{ width: 30, height: 30, objectFit: "contain" }} />
          <div className="nav-title">Service Dashboard</div>
        </Link>
        <div className="nav-right">
          {technician && (
            <>
              <span>{technician.name}</span>
              <span className="role-pill">{technician.role}</span>
            </>
          )}
          {technician?.role === "admin" && (
            <Link href="/admin/technicians" className="nav-signout" style={{ textDecoration: "none", display: "inline-block" }}>
              Admin
            </Link>
          )}
          {technician && technician.role !== "viewer" && (
            <Link href="/pm-schedules" className="nav-signout" style={{ textDecoration: "none", display: "inline-block" }}>
              PM
            </Link>
          )}
          {technician && (technician.role === "admin" || technician.role === "technician") && (
            <Link href="/knowledge-base" className="nav-signout" style={{ textDecoration: "none", display: "inline-block" }}>
              KB
            </Link>
          )}
          <button className="nav-signout" onClick={() => setShowRegions(true)}>
            Regions
          </button>
          <PushToggle />
          <button className="nav-signout" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
      {showRegions && <RegionSettingsModal onClose={() => setShowRegions(false)} />}
    </div>
  );
}
