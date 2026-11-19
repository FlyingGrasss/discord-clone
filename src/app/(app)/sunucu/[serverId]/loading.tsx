export default function WorkspaceLoading() {
  return (
    <div aria-busy="true" className="flex h-dvh w-full overflow-hidden bg-[color:var(--bg)]">
      <p className="sr-only" role="status">
        Sunucu yükleniyor…
      </p>

      <div
        aria-hidden="true"
        className="flex w-[72px] shrink-0 flex-col items-center gap-2 border-r border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-3"
      >
        {[0, 1, 2, 3].map((item) => (
          <div
            className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-[color:var(--elevated)]"
            key={item}
          />
        ))}
        <div className="mt-auto h-10 w-10 shrink-0 animate-pulse rounded-lg bg-[color:var(--elevated)]" />
      </div>

      <div
        aria-hidden="true"
        className="hidden w-60 shrink-0 border-r border-[color:var(--border)] bg-[color:var(--surface)] p-3 md:block"
      >
        <div className="flex items-center gap-2 border-b border-[color:var(--border)] pb-4">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-[color:var(--elevated)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-24 animate-pulse rounded bg-[color:var(--elevated)]" />
            <div className="h-2.5 w-12 animate-pulse rounded bg-[color:var(--elevated)]" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3 w-16 animate-pulse rounded bg-[color:var(--elevated)]" />
          {[0, 1, 2, 3, 4].map((item) => (
            <div
              className="h-7 w-full animate-pulse rounded-lg bg-[color:var(--elevated)]"
              key={item}
            />
          ))}
        </div>
      </div>

      <div aria-hidden="true" className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4">
          <div className="h-4 w-28 animate-pulse rounded bg-[color:var(--elevated)]" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
          <div className="h-4 w-40 animate-pulse rounded bg-[color:var(--elevated)]" />
          <div className="h-16 w-full max-w-xl animate-pulse rounded-xl bg-[color:var(--elevated)]" />
          <div className="h-16 w-full max-w-lg animate-pulse rounded-xl bg-[color:var(--elevated)]" />
          <div className="mt-auto h-12 w-full animate-pulse rounded-xl bg-[color:var(--elevated)]" />
        </div>
      </div>

      <div
        aria-hidden="true"
        className="hidden w-[220px] shrink-0 border-l border-[color:var(--border)] bg-[color:var(--surface)] p-3 xl:block"
      >
        <div className="h-4 w-20 animate-pulse rounded bg-[color:var(--elevated)]" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div className="flex items-center gap-2" key={item}>
              <div className="h-8 w-8 animate-pulse rounded-lg bg-[color:var(--elevated)]" />
              <div className="h-3 w-24 animate-pulse rounded bg-[color:var(--elevated)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
