// app/(app)/configuracoes/loading.tsx
export default function Loading() {
  return (
    <div className="px-6 py-6 max-w-4xl mx-auto w-full">
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="h-4 w-96 bg-slate-200 rounded" />
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-28 bg-slate-200 rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    </div>
  )
}
