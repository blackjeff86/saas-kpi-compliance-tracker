"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

type ActionPlansFiltersProps = {
  riskId?: string
  framework?: string
  responsible?: string
  status?: string
  priority?: string
  options: {
    frameworks: string[]
    responsibles: string[]
    statuses: string[]
    priorities: string[]
  }
}

function statusOptionLabel(s: string) {
  const v = s.toLowerCase()
  if (v === "done") return "Concluido"
  if (v === "blocked") return "Bloqueado"
  if (v === "in_progress") return "Em andamento"
  return "A fazer"
}

function priorityOptionLabel(value: string) {
  const v = value.toLowerCase()
  if (v === "critical") return "Critica"
  if (v === "high") return "Alta"
  if (v === "medium") return "Media"
  if (v === "low") return "Baixa"
  if (!value) return "—"
  return value
}

export default function ActionPlansFilters({
  riskId,
  framework,
  responsible,
  status,
  priority,
  options,
}: ActionPlansFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const clearParams = new URLSearchParams()
  if (riskId) clearParams.set("risk", riskId)
  const clearHref = clearParams.toString() ? `${pathname}?${clearParams.toString()}` : pathname

  function updateQuery(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value.trim()) params.set(key, value.trim())
    else params.delete(key)
    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }

  return (
    <div className="rounded-xl border border-primary/10 bg-white p-4 shadow-sm">
      <form method="GET" className="flex flex-wrap items-end gap-3">
        {riskId ? <input type="hidden" name="risk" value={riskId} /> : null}

        <div className="min-w-[160px] flex-1">
          <label htmlFor="framework" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
            Framework
          </label>
          <select
            id="framework"
            name="framework"
            value={framework ?? ""}
            onChange={(e) => updateQuery("framework", e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          >
            <option value="">Todos</option>
            {options.frameworks.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[180px] flex-1">
          <label htmlFor="responsible" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
            Responsavel
          </label>
          <select
            id="responsible"
            name="responsible"
            value={responsible ?? ""}
            onChange={(e) => updateQuery("responsible", e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          >
            <option value="">Todos</option>
            {options.responsibles.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[160px] flex-1">
          <label htmlFor="status" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={status ?? ""}
            onChange={(e) => updateQuery("status", e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          >
            <option value="">Todos</option>
            {options.statuses.map((item) => (
              <option key={item} value={item}>
                {statusOptionLabel(item)}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[160px] flex-1">
          <label htmlFor="priority" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
            Prioridade
          </label>
          <select
            id="priority"
            name="priority"
            value={priority ?? ""}
            onChange={(e) => updateQuery("priority", e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          >
            <option value="">Todas</option>
            {options.priorities.map((item) => (
              <option key={item} value={item}>
                {priorityOptionLabel(item)}
              </option>
            ))}
          </select>
        </div>

        <Link
          href={clearHref}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Limpar
        </Link>
      </form>
    </div>
  )
}
