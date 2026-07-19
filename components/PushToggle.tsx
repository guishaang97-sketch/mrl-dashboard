"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { getExistingSubscription, subscribeToPush, unsubscribeFromPush, isPushSupported } from "@/lib/push";

export default function PushToggle() {
  const { technician } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    isPushSupported().then(setSupported);
    getExistingSubscription().then((sub) => setSubscribed(!!sub));
  }, []);

  if (!technician || !supported) return null;

  async function toggle() {
    setBusy(true);
    setError("");
    if (subscribed) {
      await unsubscribeFromPush();
      setSubscribed(false);
    } else {
      const result = await subscribeToPush(technician!.id);
      if (result.ok) {
        setSubscribed(true);
      } else {
        setError(result.error || "Could not enable notifications.");
      }
    }
    setBusy(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <button className="nav-signout" onClick={toggle} disabled={busy} title={subscribed ? "Push notifications on" : "Enable push notifications"}>
        {subscribed ? "🔔 On" : "🔕 Off"}
      </button>
      {error && (
        <div
          className="msg error"
          style={{ position: "absolute", top: "110%", right: 0, width: 220, zIndex: 10 }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
