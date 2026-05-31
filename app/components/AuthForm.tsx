"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";

type AuthMode = "login" | "signup";

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isSignup ? { name, email, password } : { email, password }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error || "Authentication failed.");
        return;
      }

      router.push("/trade");
      router.refresh();
    } catch {
      setError("Could not reach the auth server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen overflow-auto bg-bg-base text-text-main">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_480px]">
        <section className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-t-border bg-bg-surface p-10">
          <div className="absolute inset-0 opacity-70">
            <div className="h-full w-full bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:44px_44px]" />
          </div>
          <div className="relative z-10 flex items-center gap-3">
            <Image src="/logo.png" alt="ApeX Logo" width={34} height={34} className="rounded-sm" />
            <span className="text-2xl font-bold tracking-wide">ApeX</span>
          </div>

          <div className="relative z-10 max-w-2xl">
            <p className="t-label-caps mb-4 text-primary">Neon secured trading profile</p>
            <h1 className="text-[44px] leading-[50px] font-semibold tracking-normal">
              {isSignup ? "Create your trading desk." : "Welcome back to the desk."}
            </h1>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                ["BTC/USD", "73,814.7", "-0.01%", "text-short"],
                ["SOL/USD", "168.42", "+2.14%", "text-long"],
                ["ETH/USD", "3,904.8", "+0.64%", "text-long"],
              ].map(([pair, price, change, color]) => (
                <div key={pair} className="b-thin bg-bg-l1 p-4">
                  <div className="t-label-caps text-text-muted">{pair}</div>
                  <div className="t-data-lg mt-3">{price}</div>
                  <div className={`t-data-sm mt-1 ${color}`}>{change}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 t-data-sm text-text-dim">
            Database: Neon Postgres · Session: HTTP-only cookie
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-8">
          <div className="w-full max-w-[390px]">
            <Link href="/trade" className="mb-10 flex items-center gap-3 no-underline lg:hidden">
              <Image src="/logo.png" alt="ApeX Logo" width={30} height={30} className="rounded-sm" />
              <span className="text-xl font-bold">ApeX</span>
            </Link>

            <div className="mb-8">
              <p className="t-label-caps text-primary">{isSignup ? "Sign up" : "Log in"}</p>
              <h2 className="t-display-lg mt-2">
                {isSignup ? "Open an account" : "Access your account"}
              </h2>
              <p className="t-body-md mt-2 text-text-muted">
                {isSignup
                  ? "Create a profile backed by the Neon database."
                  : "Continue to your ApeX trading workspace."}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {isSignup && (
                <label className="block">
                  <span className="t-label-caps mb-2 block text-text-muted">Name</span>
                  <div className="flex h-12 items-center gap-3 b-thin bg-bg-l1 px-3 focus-within:border-primary">
                    <UserRound size={16} className="text-text-dim" />
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent outline-none t-body-md text-text-main placeholder:text-text-dim"
                      placeholder="Satoshi"
                      autoComplete="name"
                    />
                  </div>
                </label>
              )}

              <label className="block">
                <span className="t-label-caps mb-2 block text-text-muted">Email</span>
                <div className="flex h-12 items-center gap-3 b-thin bg-bg-l1 px-3 focus-within:border-primary">
                  <Mail size={16} className="text-text-dim" />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent outline-none t-body-md text-text-main placeholder:text-text-dim"
                    placeholder="you@apex.exchange"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="t-label-caps mb-2 block text-text-muted">Password</span>
                <div className="flex h-12 items-center gap-3 b-thin bg-bg-l1 px-3 focus-within:border-primary">
                  <LockKeyhole size={16} className="text-text-dim" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent outline-none t-body-md text-text-main placeholder:text-text-dim"
                    placeholder="Minimum 8 characters"
                    type="password"
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    minLength={8}
                    required
                  />
                </div>
              </label>

              {error && <div className="b-thin border-text-error bg-bg-l1 p-3 t-body-sm text-text-error">{error}</div>}

              <button
                className="flex h-12 w-full items-center justify-center gap-2 bg-primary-ctr px-4 t-label-caps text-white hover:opacity-95 disabled:cursor-wait disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Please wait" : isSignup ? "Create account" : "Log in"}
                <ArrowRight size={15} />
              </button>
            </form>

            <p className="t-body-sm mt-6 text-text-muted">
              {isSignup ? "Already have an account?" : "Need an account?"}{" "}
              <Link href={isSignup ? "/login" : "/signup"} className="text-primary no-underline hover:underline">
                {isSignup ? "Log in" : "Sign up"}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
