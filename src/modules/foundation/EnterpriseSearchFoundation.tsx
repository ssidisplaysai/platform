"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FOUNDATION_SEARCH_INDEX } from "./navigation";
import { resolvePermissions } from "./permissions";
import { searchFoundationIndex } from "./selectors";
import { createFoundationContext } from "./context";

export function EnterpriseSearchFoundation() {
  const foundationContext = useMemo(() => createFoundationContext(), []);
  const permissions = useMemo(
    () => resolvePermissions(foundationContext.user.roles),
    [foundationContext.user.roles],
  );
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => searchFoundationIndex(FOUNDATION_SEARCH_INDEX, permissions, query),
    [permissions, query],
  );

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">
          Enterprise Search Foundation
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
          Search Organizations, Sites, Users, and Settings
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          This foundation provides the application-level interface contract for
          discoverability across commerce operations.
        </p>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the commerce foundation..."
          className="mt-5 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm text-white outline-none focus:border-red-500"
        />
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
        <ul>
          {results.map((result) => (
            <li
              key={result.id}
              className="border-b border-zinc-900 px-6 py-4 last:border-b-0"
            >
              <Link
                href={result.href}
                className="block rounded-lg p-2 transition hover:bg-zinc-900"
              >
                <p className="text-base font-semibold text-white">{result.title}</p>
                <p className="text-sm text-zinc-400">{result.subtitle}</p>
                <p className="mt-1 text-xs uppercase tracking-widest text-zinc-500">
                  Scope: {result.scope}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        {results.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500">
            No search results matched this query.
          </p>
        ) : null}
      </div>
    </section>
  );
}
