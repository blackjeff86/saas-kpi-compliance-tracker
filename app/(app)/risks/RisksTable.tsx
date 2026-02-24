"use client"

import { useRouter } from "next/navigation"

type Row = {
  id: string
  risk_code: string
  title: string
  source: string | null
  natureza: string | null
  classification: string
  responsible_name: string | null
  status: string
}

function riskBadge(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("critical")) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  if (s.includes("high")) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
  if (s.includes("med") || s.includes("moderate") || s.includes("medium"))
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
  if (s.includes("low")) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
  return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400"
}

function statusBadge(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s === "aberto" || s === "open") return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
  if (s === "em mitigação" || s === "mitigating") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
  if (s === "aceito" || s === "accepted") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
  if (s === "fechado" || s === "closed") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
  if (s === "catalogado") return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
}

export default function RisksTable({ rows }: { rows: Row[] }) {
  const router = useRouter()

  const go = (id: string) => {
    router.push(`/risks/${id}`)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              ID do risco
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Nome do risco
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Fonte
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Natureza
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Criticidade
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Responsável
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Status
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => (
            <tr
              key={r.id}
              className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
              role="button"
              tabIndex={0}
              onClick={() => go(r.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") go(r.id)
              }}
              aria-label={`Abrir risco ${r.risk_code}`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="mt-1 h-8 w-1 rounded-full bg-transparent group-hover:bg-primary/60 transition-colors" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      <span className="font-mono text-slate-500 dark:text-slate-400">{r.risk_code}</span>
                    </div>
                  </div>
                </div>
              </td>

              <td className="px-4 py-3 min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[220px]">
                  {r.title || "—"}
                </div>
              </td>

              <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{r.source || "—"}</td>

              <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{r.natureza || "—"}</td>

              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskBadge(
                    r.classification
                  )}`}
                >
                  <span className="w-1 h-1 rounded-full bg-current opacity-60 mr-1.5" />
                  {r.classification || "—"}
                </span>
              </td>

              <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                {r.responsible_name || "—"}
              </td>

              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(
                    r.status
                  )}`}
                >
                  <span className="w-1 h-1 rounded-full bg-current opacity-60 mr-1.5" />
                  {r.status || "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
