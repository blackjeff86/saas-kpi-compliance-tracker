// app/(app)/kpis/[id]/loading.tsx
export default function Loading() {
  return (
    <div className="px-6 py-6 max-w-4xl mx-auto w-full animate-pulse">
      <div className="h-8 w-56 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-40 bg-slate-200 rounded mb-6" />
      <div className="h-32 bg-slate-100 rounded-xl" />
    </div>
  )
}
