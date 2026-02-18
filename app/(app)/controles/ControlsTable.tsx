// app/(app)/controles/ControlsTable.tsx
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

  /**
   * ✅ Novo status de controle (do mês):
   * critical | warning | overdue | pending | effective | not_applicable
   */
  control_result: string | null

  kpi_total: number
  kpi_red: number
  kpi_yellow: number
  kpi_green: number
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

function resultLabel(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s === "critical") return "Critical"
  if (s === "warning") return "Warning"
  if (s === "overdue") return "Overdue"
  if (s === "pending") return "Pending"
  if (s === "effective") return "Effective"
  if (s === "not_applicable" || s === "not-applicable") return "Not applicable"
  return "—"
}

function resultBadge(v?: string | null) {
  const s = (v || "").toLowerCase()

  // 🔴 Critical (has red)
  if (s === "critical") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"

  // 🟡 Warning (has yellow and no red)
  if (s === "warning") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"

  // 🟠 Overdue (missing and month already passed)
  if (s === "overdue") return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"

  // ⚪ Pending (waiting for execution)
  if (s === "pending") return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"

  // 🟢 Effective (all applicable KPIs are green)
  if (s === "effective") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"

  // 🚫 Not applicable (outside frequency cycle)
  if (s === "not_applicable" || s === "not-applicable")
    return "bg-slate-50 text-slate-500 border border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800"

  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
}

function Dot({ kind }: { kind: "red" | "yellow" | "green" }) {
  const cls = kind === "red" ? "bg-red-500" : kind === "yellow" ? "bg-yellow-500" : "bg-emerald-500"
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls}`} />
}

export default function ControlsTable({ rows, mes_ref }: { rows: Row[]; mes_ref?: string }) {
  const router = useRouter()

  const go = (id: string) => {
    const qs = mes_ref ? `?mes_ref=${encodeURIComponent(mes_ref)}` : ""
    router.push(`/controles/${id}${qs}`)
  }

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
              Result (month)
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
                <div className="flex items-center gap-3">
                  <div className="mt-1 h-8 w-1 rounded-full bg-transparent group-hover:bg-primary/60 transition-colors" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      <span className="font-mono text-slate-500 dark:text-slate-400">{r.control_code}</span>
                      <span className="mx-2 text-slate-300 dark:text-slate-700">|</span>
                      {r.name}
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

              <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{r.frequency ?? "—"}</td>

              <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                {r.control_owner_name || r.control_owner_email || "—"}
              </td>

              <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                {r.focal_point_name || r.focal_point_email || "—"}
              </td>

              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <span
                    className={`inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${resultBadge(
                      r.control_result
                    )}`}
                    title="Resultado do controle no mês (agregado por KPIs + frequência)"
                  >
                    <span className="w-1 h-1 rounded-full bg-current opacity-60 mr-1.5" />
                    {resultLabel(r.control_result)}
                  </span>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      KPIs: <span className="font-mono">{r.kpi_total ?? 0}</span>
                    </span>

                    <span className="text-slate-300 dark:text-slate-700">•</span>

                    <span className="inline-flex items-center gap-1" title="Red">
                      <Dot kind="red" />
                      <span className="font-mono">{r.kpi_red ?? 0}</span>
                    </span>

                    <span className="inline-flex items-center gap-1" title="Yellow">
                      <Dot kind="yellow" />
                      <span className="font-mono">{r.kpi_yellow ?? 0}</span>
                    </span>

                    <span className="inline-flex items-center gap-1" title="Green">
                      <Dot kind="green" />
                      <span className="font-mono">{r.kpi_green ?? 0}</span>
                    </span>
                  </div>
                </div>
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
