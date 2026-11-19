export default function AppLoading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6"
    >
      <p className="sr-only" role="status">
        Yükleniyor…
      </p>

      <div aria-hidden="true" className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-[color:var(--elevated)]" />
        <div className="h-10 w-24 animate-pulse rounded-lg bg-[color:var(--elevated)]" />
      </div>

      <div aria-hidden="true" className="space-y-3">
        <div className="h-4 w-28 animate-pulse rounded bg-[color:var(--elevated)]" />
        <div className="h-8 w-64 animate-pulse rounded bg-[color:var(--elevated)]" />
        <div className="h-4 w-full max-w-md animate-pulse rounded bg-[color:var(--elevated)]" />
      </div>

      <div
        aria-hidden="true"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {[0, 1, 2].map((item) => (
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
  );
}
