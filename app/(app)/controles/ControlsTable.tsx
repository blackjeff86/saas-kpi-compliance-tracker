"use client"

import { useRouter } from "next/navigation"

type Row = {
  id: string
  control_code: string
  name: string
  framework: string | null
  frequency: string | null
  risk_level: string | null
  created_at: string
  mes_ref: string | null
  control_owner_name: string | null
  control_owner_email: string | null
  focal_point_name: string | null
  focal_point_email: string | null
  control_result: string | null
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

function frameworkPill() {
  return "bg-primary/10 text-primary"
}

function resultBadge(v?: string | null) {
  const s = (v || "").toLowerCase()
  // suportando seus nomes atuais (gap/warning/ok/no-data) e também red/yellow/green
  if (s === "gap" || s === "red") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  if (s === "warning" || s === "yellow") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
  if (s === "ok" || s === "green") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
}

export default function ControlsTable({ rows }: { rows: Row[] }) {
  const router = useRouter()

  const go = (id: string) => router.push(`/controles/${id}`)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Controle
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Framework
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Frequência
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Control Owner
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Focal Point
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Resultado (mês)
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Risco
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
              aria-label={`Abrir controle ${r.control_code}`}
            >
              <td className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-8 w-1 rounded-full bg-transparent group-hover:bg-primary/60 transition-colors" />

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {r.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      <span className="font-mono">{r.control_code}</span>
                      <span className="mx-2 text-slate-300 dark:text-slate-700">•</span>
                      <span>
                        Mês: <span className="font-mono">{r.mes_ref ?? "—"}</span>
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Criado em: <span className="font-mono">{r.created_at}</span>
                    </div>
                  </div>
                </div>
              </td>

              <td className="px-4 py-3">
                {r.framework ? (
                  <span className={`px-2 py-0.5 ${frameworkPill()} text-[10px] font-bold rounded uppercase`}>
                    {r.framework}
                  </span>
                ) : (
                  <span className="text-sm text-slate-500">—</span>
                )}
              </td>

              <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                {r.frequency ?? "—"}
              </td>

              <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                {r.control_owner_name || r.control_owner_email || "—"}
              </td>

              <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                {r.focal_point_name || r.focal_point_email || "—"}
              </td>

              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${resultBadge(
                    r.control_result
                  )}`}
                  title="Resultado do controle no mês (pior KPI)"
                >
                  <span className="w-1 h-1 rounded-full bg-current opacity-60 mr-1.5" />
                  {r.control_result ?? "—"}
                </span>
              </td>

              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskBadge(
                    r.risk_level
                  )}`}
                >
                  <span className="w-1 h-1 rounded-full bg-current opacity-60 mr-1.5" />
                  {r.risk_level ?? "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
