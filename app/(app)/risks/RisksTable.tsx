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
  impact: number | null
  likelihood: number | null
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

function statusLabel(s?: string | null) {
  const v = (s || "").toLowerCase()
  if (v === "open" || v === "aberto") return "Em aberto"
  if (v === "mitigating" || v === "em mitigação") return "Em mitigação"
  if (v === "accepted" || v === "aceito") return "Aceito"
  if (v === "closed" || v === "fechado") return "Fechado"
  if (v === "catalogado") return "Catalogado"
  return s || "—"
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

export default function RisksTable({ rows, returnTo }: { rows: Row[]; returnTo?: string }) {
  const router = useRouter()

  const go = (id: string) => {
    const url = returnTo ? `/risks/${id}?returnTo=${encodeURIComponent(returnTo)}` : `/risks/${id}`
    router.push(url)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#F2F6FF] border-b border-slate-200 dark:border-slate-800">
            <th className="ui-table-th px-4 py-3">ID do risco</th>
            <th className="ui-table-th px-4 py-3">Nome do risco</th>
            <th className="ui-table-th px-4 py-3">Fonte</th>
            <th className="ui-table-th px-4 py-3">Natureza</th>
            <th className="ui-table-th px-4 py-3">Criticidade</th>
            <th className="ui-table-th px-4 py-3">Impacto</th>
            <th className="ui-table-th px-4 py-3">Probab.</th>
            <th className="ui-table-th px-4 py-3">Responsável</th>
            <th className="ui-table-th px-4 py-3">Status</th>
          </tr>
        </thead>

        <tbody className="ui-table-tbody divide-y divide-slate-100 dark:divide-slate-800">
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
                  <div className="mt-1 h-8 w-1 rounded-full bg-transparent group-hover:bg-[#06B6D4]/60 transition-colors" />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      <span className="font-mono text-slate-500 dark:text-slate-400">{r.risk_code}</span>
                    </div>
                  </div>
                </div>
              </td>

              <td className="px-4 py-3 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[220px]">
                  {r.title || "—"}
                </div>
              </td>

              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{r.source || "—"}</td>

              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{r.natureza || "—"}</td>

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

              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                {r.impact != null ? r.impact : "—"}
              </td>

              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                {r.likelihood != null ? r.likelihood : "—"}
              </td>

              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                {r.responsible_name || "—"}
              </td>

              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(
                    r.status
                  )}`}
                >
                  <span className="w-1 h-1 rounded-full bg-current opacity-60 mr-1.5" />
                  {statusLabel(r.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
