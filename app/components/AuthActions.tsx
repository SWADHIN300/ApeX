"use client";

import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
};

export default function AuthActions() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { user: User | null }) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  if (loading) {
    return <div className="hidden lg:block h-8 w-28 bg-bg-l2 b-thin" aria-hidden />;
  }

  if (user) {
    return (
      <div className="hidden lg:flex items-center gap-2">
        <div className="h-8 max-w-40 flex items-center gap-2 bg-bg-l2 b-thin px-3 text-text-main">
          <UserRound size={14} className="shrink-0 text-primary" />
          <span className="t-label-caps truncate">{user.name}</span>
        </div>
        <button
          onClick={logout}
          className="w-8 h-8 flex items-center justify-center b-thin bg-bg-l1 text-text-muted hover:bg-bg-l4 hover:text-text-main"
          aria-label="Log out"
          title="Log out"
          type="button"
        >
          <LogOut size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="hidden lg:flex items-center gap-2">
      <Link
        href="/login"
        className="h-8 px-4 flex items-center justify-center bg-bg-l2 b-thin text-text-main t-label-caps no-underline hover:bg-bg-l4"
      >
        Log in
      </Link>
      <Link
        href="/signup"
        className="h-8 px-4 flex items-center justify-center bg-text-main text-bg-base t-label-caps no-underline hover:opacity-90"
      >
        Sign up
      </Link>
    </div>
  );
}
