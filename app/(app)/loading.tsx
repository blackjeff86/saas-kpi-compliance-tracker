export default function AppSegmentLoading() {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="h-28 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-28 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-28 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-28 animate-pulse rounded-xl bg-slate-200" />
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-slate-200" />
      </div>
    </div>
  )
}

