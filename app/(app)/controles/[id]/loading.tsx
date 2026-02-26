// app/(app)/controles/[id]/loading.tsx
export default function Loading() {
  return (
    <div className="px-6 py-6 max-w-6xl mx-auto w-full animate-pulse">
      <div className="h-8 w-64 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-48 bg-slate-200 rounded mb-6" />
      <div className="flex gap-2 border-b pb-2 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-24 bg-slate-200 rounded-lg" />
        ))}
      </div>
      <div className="h-48 bg-slate-100 rounded-xl" />
    </div>
  )
}
