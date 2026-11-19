export default function ChannelLoading() {
  return (
    <div
      aria-busy="true"
      className="flex min-h-0 flex-1 flex-col bg-[color:var(--bg)]"
    >
      <p className="sr-only" role="status">
        Kanal yükleniyor…
      </p>

      <div
        aria-hidden="true"
        className="flex h-12 shrink-0 items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4"
      >
        <div className="h-4 w-28 animate-pulse rounded bg-[color:var(--elevated)]" />
        <div className="h-3 w-14 animate-pulse rounded bg-[color:var(--elevated)]" />
      </div>

      <div aria-hidden="true" className="min-h-0 flex-1 space-y-5 overflow-hidden p-4">
        {[0, 1, 2, 3, 4].map((item) => (
          <div className="flex items-start gap-3" key={item}>
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-[color:var(--elevated)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-28 animate-pulse rounded bg-[color:var(--elevated)]" />
              <div className="h-3 w-full max-w-xl animate-pulse rounded bg-[color:var(--elevated)]" />
              <div className="h-3 w-2/3 max-w-md animate-pulse rounded bg-[color:var(--elevated)]" />
            </div>
          </div>
        ))}
      </div>

      <div
        aria-hidden="true"
        className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-4 pb-4 pt-3"
      >
        <div className="h-12 w-full animate-pulse rounded-xl bg-[color:var(--elevated)]" />
      </div>
    </div>
  );
}
