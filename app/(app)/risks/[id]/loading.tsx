// app/(app)/risks/[id]/loading.tsx
export default function Loading() {
  return (
    <div className="px-6 py-6 max-w-6xl mx-auto w-full animate-pulse">
      <div className="h-8 w-72 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-56 bg-slate-200 rounded mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-48 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    </div>
  )
}
