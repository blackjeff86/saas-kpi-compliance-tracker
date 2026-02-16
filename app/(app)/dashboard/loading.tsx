// app/(app)/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto w-full">
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-52 bg-slate-200 rounded" />
        <div className="h-16 bg-white border border-slate-200 rounded-xl" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200">
              <div className="h-10 w-10 bg-slate-200 rounded-lg mb-4" />
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-7 w-20 bg-slate-200 rounded mt-2" />
            </div>
          ))}
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="h-5 w-56 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-80 bg-slate-200 rounded mb-6" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="h-14 bg-slate-50 border-b" />
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
