"use client"

import { useRouter } from "next/navigation"

type Row = {
  id: string
  kpi_code: string
  kpi_name: string
  kpi_type: string | null
  target_operator: string | null
  target_value: number | null
  is_active: boolean
  created_at: string
  month_status: string | null
  month_suggested_status: string | null
  month_final_status: string | null
  month_result_numeric: number | null
  mes_ref_used: string
  framework: string | null
  frequency: string | null
  control_owner_name: string | null
  control_owner_email: string | null
  focal_point_name: string | null
  focal_point_email: string | null
  next_execution_date: string | null
}

function frameworkPill() {
  return "ui-badge-info"
}

function normalizeStatus(v?: string | null) {
  const raw = (v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()

  if (!raw) return ""

  if (
    raw === "not_applicable" ||
    raw === "not applicable" ||
    raw === "not-applicable" ||
    raw === "not_aplicable" ||
    raw === "not aplicable" ||
    raw === "not-aplicable" ||
    raw === "nao aplicavel"
  ) {
    return "not_applicable"
  }

  if (raw === "needs changes") return "needs_changes"
  if (raw === "under review") return "under_review"

  return raw.replace(/\s+/g, "_")
}

function kpiStatusLabel(v?: string | null) {
  const s = normalizeStatus(v)
  if (!s) return "—"
  if (s === "not_applicable") return "not_applicable"
  return s
}

function kpiStatusBadge(v?: string | null) {
  const s = normalizeStatus(v)
  if (
    s.includes("in_target") ||
    s.includes("in target") ||
    s.includes("ok") ||
    s.includes("green") ||
    s.includes("effective") ||
    s.includes("pass")
  )
    return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (
    s.includes("warning") ||
    s.includes("warn") ||
    s.includes("yellow") ||
    s.includes("medium") ||
    s.includes("moderate") ||
    s === "overdue" ||
    s === "pending"
  )
    return "bg-amber-50 text-amber-700 border-amber-200"
  if (
    s === "out" ||
    s.includes("out_of_target") ||
    s.includes("out of target") ||
    s.includes("critical") ||
    s.includes("gap") ||
    s.includes("red") ||
    s.includes("fail")
  )
    return "bg-red-50 text-red-700 border-red-200"
  if (s === "not_applicable" || s === "not-applicable")
    return "bg-slate-50 text-slate-700 border-slate-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

function finalReviewBadge(v?: string | null) {
  const s = normalizeStatus(v)
  if (s === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (s === "needs_changes") return "bg-amber-50 text-amber-700 border-amber-200"
  if (s === "rejected") return "bg-red-50 text-red-700 border-red-200"
  if (s === "pending") return "bg-amber-50 text-amber-700 border-amber-200"
  if (s === "under_review" || s === "submitted") return "bg-slate-50 text-slate-700 border-slate-200"
  if (s === "not_applicable" || s === "not-applicable") return "bg-slate-50 text-slate-700 border-slate-200"
  if (s === "overdue") return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

function finalReviewLabel(v?: string | null) {
  const s = normalizeStatus(v)
  if (!s) return "—"
  if (s === "not_applicable") return "not_applicable"
  return s
}

function formatDateDdMmYyyy(v?: string | null) {
  if (!v) return "—"
  const s = String(v).trim()

  // Já vem do backend nesse formato em alguns cenários.
  const ddMmYyyy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (ddMmYyyy) return `${ddMmYyyy[1]}/${ddMmYyyy[2]}/${ddMmYyyy[3]}`

  // ISO date/date-time -> dd/mm/aaaa.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`

  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return "—"
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = String(d.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

export default function KpisTable({
  rows,
  mes_ref,
  returnTo,
}: {
  rows: Row[]
  mes_ref: string
  returnTo?: string
}) {
  const router = useRouter()

  const detailHref = (id: string) => {
    const params = new URLSearchParams()
    if (mes_ref) params.set("mes_ref", mes_ref)
    if (returnTo) params.set("returnTo", returnTo)
    params.set("from", "kpis")
    const qs = params.toString() ? `?${params.toString()}` : ""
    return `/kpis/${id}${qs}`
  }

  const go = (id: string) => {
    router.push(detailHref(id))
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#F2F6FF] border-b border-slate-200 dark:border-slate-800">
            <th className="ui-table-th px-4 py-3">Código</th>
            <th className="ui-table-th px-4 py-3">Nome</th>
            <th className="ui-table-th px-4 py-3">Framework</th>
            <th className="ui-table-th px-4 py-3">Frequência</th>
            <th className="ui-table-th px-4 py-3">Responsável controle</th>
            <th className="ui-table-th px-4 py-3">Ponto focal</th>
            <th className="ui-table-th px-4 py-3">Meta</th>
            <th className="ui-table-th px-4 py-3">Valor (mês)</th>
            <th className="ui-table-th px-4 py-3">Resultado sugerido</th>
            <th className="ui-table-th px-4 py-3">Resultado (mês)</th>
            <th className="ui-table-th px-4 py-3">Próxima execução</th>
          </tr>
        </thead>
        <tbody className="ui-table-tbody divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => {
            const isActive = Boolean(r.is_active)
            const targetValue = r.target_value
            const monthStatus = (r.month_suggested_status ?? r.month_status ?? "") as string
            const monthFinalStatus = (r.month_final_status ?? "") as string
            const monthResult =
              r.month_result_numeric === null || r.month_result_numeric === undefined
                ? null
                : Number(r.month_result_numeric)
            const metaText =
              !isActive || targetValue === null || targetValue === undefined
                ? "—"
                : String(targetValue)
            const controlOwner = r.control_owner_name || r.control_owner_email || "—"
            const focalPoint = r.focal_point_name || r.focal_point_email || "—"

            return (
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
                aria-label={`Abrir KPI ${r.kpi_code}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="mt-1 h-8 w-1 rounded-full bg-transparent group-hover:bg-[#06B6D4]/60 transition-colors" />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          {r.kpi_code}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                    {r.kpi_name}
                  </div>
                  {!isActive ? (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">inativo</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {r.framework ? (
                    <span
                      className={`px-2 py-0.5 ${frameworkPill()} text-[10px] font-bold rounded uppercase`}
                    >
                      {r.framework}
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                  {r.frequency ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                  {controlOwner}
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                  {focalPoint}
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                  {metaText}
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                  {monthResult === null || Number.isNaN(monthResult) ? "—" : monthResult}
                </td>
                <td className="px-4 py-3">
                  {monthStatus ? (
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-medium ${kpiStatusBadge(
                        monthStatus
                      )}`}
                      title={`auto_status no mês ${r.mes_ref_used ?? mes_ref}`}
                    >
                      {kpiStatusLabel(monthStatus)}
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {monthFinalStatus ? (
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-medium ${finalReviewBadge(
                        monthFinalStatus
                      )}`}
                      title={`Resultado final após revisão GRC no mês ${r.mes_ref_used ?? mes_ref}`}
                    >
                      {finalReviewLabel(monthFinalStatus)}
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                  {formatDateDdMmYyyy(r.next_execution_date)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
