import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GlwLoginForm } from "@/components/glw/login-form";
import { getGlwSession } from "@/lib/glw/auth";

export const metadata: Metadata = {
  title: "GLW Login",
  description: "Sign in to the GLW operations console.",
};

export default async function GlwLoginPage() {
  const session = await getGlwSession();

  if (session) {
    redirect("/glw");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.2fr_0.9fr] lg:gap-12">
          <section className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-400">
                GLW
              </p>
              <h1 className="max-w-lg text-4xl font-semibold tracking-tight text-white lg:text-5xl">
                LED Display Warehouse operations, organized for daily production.
              </h1>
              <p className="max-w-xl text-sm leading-6 text-zinc-400 lg:text-base">
                Access the GLW workspace to review pages, blogs, jobs, and site
                operations from a focused console.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Protected access", "Session-backed admin sign in"],
                ["Operational focus", "Pages, blogs, queue, and settings"],
                ["Site scoped", "LED Display Warehouse selected"],
                ["Fast handoff", "Minimal surface, no extra noise"],
              ].map(([title, text]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4"
                >
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl shadow-black/20">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">
                Admin Sign In
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Sign in to GLW
              </h2>
              <p className="text-sm leading-6 text-zinc-400">
                Use the configured admin email and password to continue.
              </p>
            </div>

            <div className="mt-8">
              <GlwLoginForm />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
