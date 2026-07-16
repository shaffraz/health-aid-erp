"use client";

import { useState } from "react";
import { Activity, ArrowRight, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { defaultSystemSettings } from "@/lib/settings";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { roleLabels } from "@/lib/permissions";
import { roles, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LoginPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const demo = !isSupabaseConfigured() || process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      window.location.assign("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  function enterDemo(role: Role) {
    document.cookie = `demo_role=${role}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.assign(
      role === "doctor"
        ? "/doctor-portal"
        : role === "assistance_company"
          ? "/insurance-claims"
          : "/dashboard"
    );
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/80 bg-white shadow-soft lg:grid-cols-[0.9fr_1.1fr]">
        <section className="bg-ink p-8 text-white lg:p-10">
          <div className="rounded-2xl bg-white p-4 shadow-soft">
            <BrandLogo priority />
          </div>
          <h1 className="mt-8 text-3xl font-bold tracking-tight">
            {defaultSystemSettings.clinic.clinicName} ERP
          </h1>
          <p className="mt-4 text-sm leading-6 text-cyan-50">
            Secure healthcare billing, doctor payouts, vouchers, and reporting without creating patient profiles yet.
            Patient identity is intentionally stored only inside invoices for this MVP.
          </p>
          <div className="mt-8 grid gap-3 text-sm">
            {[
              "Role-aware access for administrator, director, staff, doctor, and assistance company users",
              "Automatic doctor payout generation from invoice services",
              "PostgreSQL RLS policies keep doctor earnings private"
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-care-300" aria-hidden="true" />
                <span className="text-cyan-50">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="p-8 lg:p-10">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-lagoon-50 p-2 text-lagoon-700">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="label">Secure access</p>
              <h2 className="text-xl font-bold text-ink">Sign in</h2>
            </div>
          </div>

          <form onSubmit={signIn} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field mt-2"
                placeholder="administrator@healthaid.lk"
                required={!demo}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field mt-2"
                placeholder="Your password"
                required={!demo}
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || demo}
              className={cn(
                "focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
                demo ? "bg-slate-300" : "bg-lagoon-600 hover:bg-lagoon-700"
              )}
            >
              {loading ? "Signing in..." : "Sign in with Supabase"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          {demo ? (
            <div className="mt-8 rounded-xl border border-dashed border-lagoon-200 bg-lagoon-50/70 p-4">
              <p className="text-sm font-semibold text-ink">Demo mode is active</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Supabase environment variables are not connected yet. Choose a role to review scoped workflows.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {roles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => enterDemo(role)}
                    className="focus-ring rounded-lg border border-white bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-lagoon-200 hover:text-lagoon-700"
                  >
                    Enter as {roleLabels[role]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
