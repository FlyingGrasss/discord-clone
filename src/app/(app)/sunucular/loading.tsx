export default function ServersLoading() {
  return (
    <div aria-busy="true" className="min-h-dvh">
      <p className="sr-only" role="status">
        Sunucular yükleniyor…
      </p>

      <div
        aria-hidden="true"
        className="h-16 border-b border-[color:var(--border)] bg-[color:var(--surface)]"
      >
        <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="h-8 w-28 animate-pulse rounded-lg bg-[color:var(--elevated)]" />
          <div className="h-9 w-9 animate-pulse rounded-xl bg-[color:var(--elevated)]" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div aria-hidden="true" className="space-y-3">
          <div className="h-3 w-20 animate-pulse rounded bg-[color:var(--elevated)]" />
          <div className="h-8 w-56 animate-pulse rounded bg-[color:var(--elevated)]" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-[color:var(--elevated)]" />
        </div>

        <div
          aria-hidden="true"
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div
              className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
              key={item}
            >
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-[color:var(--elevated)]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-[color:var(--elevated)]" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-[color:var(--elevated)]" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
