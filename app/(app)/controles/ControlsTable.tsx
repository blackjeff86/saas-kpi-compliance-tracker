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
  control_result_suggested: string | null

  kpi_total: number
  kpi_red: number
  kpi_yellow: number
  kpi_green: number
  kpi_reviewed_red: number
  kpi_reviewed_yellow: number
  kpi_reviewed_green: number
}

function riskBadge(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("critical")) return "ui-badge-danger"
  if (s.includes("high")) return "ui-badge-warning"
  if (s.includes("med") || s.includes("moderate") || s.includes("medium"))
    return "ui-badge-warning"
  if (s.includes("low")) return "ui-badge-success"
  return "ui-badge-neutral"
}

function frameworkPill() {
  return "ui-badge-info"
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
  if (s === "critical") return "bg-red-50 text-red-700 border-red-200"

  // 🟡 Warning (has yellow and no red)
  if (s === "warning") return "bg-amber-50 text-amber-700 border-amber-200"

  // 🟠 Overdue (missing and month already passed)
  if (s === "overdue") return "bg-amber-50 text-amber-700 border-amber-200"

  // ⚪ Pending (waiting for execution)
  if (s === "pending") return "bg-amber-50 text-amber-700 border-amber-200"

  // 🟢 Effective (all applicable KPIs are green)
  if (s === "effective") return "bg-emerald-50 text-emerald-700 border-emerald-200"

  // 🚫 Not applicable (outside frequency cycle)
  if (s === "not_applicable" || s === "not-applicable") return "bg-slate-50 text-slate-700 border-slate-200"

  return "bg-slate-50 text-slate-700 border-slate-200"
}

function Dot({ kind }: { kind: "red" | "yellow" | "green" }) {
  const cls = kind === "red" ? "bg-risk-critical" : kind === "yellow" ? "bg-risk-medium" : "bg-risk-low"
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls}`} />
}

function ResultCounts({
  total,
  red,
  yellow,
  green,
  titles = { red: "Red", yellow: "Yellow", green: "Green" },
}: {
  total: number
  red: number
  yellow: number
  green: number
  titles?: { red: string; yellow: string; green: string }
}) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
      <span className="font-medium whitespace-nowrap mr-1">
        KPIs: <span className="font-mono tabular-nums">{total}</span>
      </span>
      <span className="text-slate-300 dark:text-slate-700">•</span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap" title={titles.red}>
        <Dot kind="red" />
        <span className="font-mono tabular-nums">{red}</span>
      </span>
      <span className="text-slate-300 dark:text-slate-700">•</span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap" title={titles.yellow}>
        <Dot kind="yellow" />
        <span className="font-mono tabular-nums">{yellow}</span>
      </span>
      <span className="text-slate-300 dark:text-slate-700">•</span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap" title={titles.green}>
        <Dot kind="green" />
        <span className="font-mono tabular-nums">{green}</span>
      </span>
    </div>
  )
}

export default function ControlsTable({ rows, mes_ref }: { rows: Row[]; mes_ref?: string }) {
  const router = useRouter()

  const detailHref = (id: string) => {
    const qs = mes_ref ? `?mes_ref=${encodeURIComponent(mes_ref)}` : ""
    return `/controles/${id}${qs}`
  }

  const go = (id: string) => {
    router.push(detailHref(id))
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#F2F6FF] border-b border-slate-200 dark:border-slate-800">
            <th className="ui-table-th px-4 py-3 min-w-[130px]">Código</th>
            <th className="ui-table-th px-4 py-3 min-w-[220px]">Nome</th>
            <th className="ui-table-th px-4 py-3 min-w-[120px]">Risco</th>
            <th className="ui-table-th px-4 py-3 min-w-[120px]">Framework</th>
            <th className="ui-table-th px-4 py-3 min-w-[120px]">Frequência</th>
            <th className="ui-table-th px-4 py-3 min-w-[170px]">Responsável controle</th>
            <th className="ui-table-th px-4 py-3 min-w-[140px]">Ponto focal</th>
            <th className="ui-table-th px-4 py-3 min-w-[260px]">Resultado sugerido</th>
            <th className="ui-table-th px-4 py-3 min-w-[260px]">Resultado (mês)</th>
          </tr>
        </thead>

        <tbody className="ui-table-tbody divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => (
            <tr
              key={r.id}
              className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
              role="button"
              tabIndex={0}
              onMouseEnter={() => router.prefetch(detailHref(r.id))}
              onFocus={() => router.prefetch(detailHref(r.id))}
              onClick={() => go(r.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") go(r.id)
              }}
              aria-label={`Abrir controle ${r.control_code}`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="mt-1 h-8 w-1 rounded-full bg-transparent group-hover:bg-[#06B6D4]/60 transition-colors" />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      <span className="font-mono text-slate-500 dark:text-slate-400">{r.control_code}</span>
                    </div>
                  </div>
                </div>
              </td>

              <td className="px-4 py-3 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {r.name}
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

              <td className="px-4 py-3">
                {r.framework ? (
                  <span className={`px-2 py-0.5 ${frameworkPill()} text-[10px] font-bold rounded uppercase`}>
                    {r.framework}
                  </span>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </td>

              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{r.frequency ?? "—"}</td>

              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                {r.control_owner_name || r.control_owner_email || "—"}
              </td>

              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                {r.focal_point_name || r.focal_point_email || "—"}
              </td>

              <td className="px-4 py-3 align-top">
                <div className="flex flex-col">
                  <span
                    className={`inline-flex self-start items-center px-2 py-1 rounded-md border text-xs font-medium ${resultBadge(
                      r.control_result_suggested
                    )}`}
                    title="Resultado sugerido (agregado do auto_status dos KPIs)"
                  >
                    {resultLabel(r.control_result_suggested)}
                  </span>

                  <ResultCounts
                    total={r.kpi_total ?? 0}
                    red={r.kpi_red ?? 0}
                    yellow={r.kpi_yellow ?? 0}
                    green={r.kpi_green ?? 0}
                  />
                </div>
              </td>

              <td className="px-4 py-3 align-top">
                <div className="flex flex-col">
                  <span
                    className={`inline-flex self-start items-center px-2 py-1 rounded-md border text-xs font-medium ${resultBadge(
                      r.control_result
                    )}`}
                    title="Resultado final do controle no mês (após revisão GRC)"
                  >
                    {resultLabel(r.control_result)}
                  </span>

                  <ResultCounts
                    total={r.kpi_total ?? 0}
                    red={r.kpi_reviewed_red ?? 0}
                    yellow={r.kpi_reviewed_yellow ?? 0}
                    green={r.kpi_reviewed_green ?? 0}
                    titles={{
                      red: "Red (revisados GRC)",
                      yellow: "Yellow (revisados GRC)",
                      green: "Green (revisados GRC)",
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

