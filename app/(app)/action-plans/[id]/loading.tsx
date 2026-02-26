// app/(app)/action-plans/[id]/loading.tsx
export default function Loading() {
  return (
    <div className="px-6 py-6 max-w-5xl mx-auto w-full animate-pulse">
      <div className="h-8 w-64 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-48 bg-slate-200 rounded mb-6" />
      <div className="h-40 bg-slate-100 rounded-xl mb-6" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-slate-100 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
