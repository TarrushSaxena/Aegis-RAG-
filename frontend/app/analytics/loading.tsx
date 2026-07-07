export default function AnalyticsLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-6 py-4">
        <div className="skeleton h-8 w-28 rounded-lg" />
        <div className="space-y-1.5">
          <div className="skeleton h-4 w-32 rounded-full" />
          <div className="skeleton h-3 w-64 rounded-full" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="skeleton h-56 rounded-2xl" />
          <div className="skeleton h-56 rounded-2xl" />
        </div>
        <div className="skeleton h-48 rounded-2xl" />
      </main>
    </div>
  );
}
