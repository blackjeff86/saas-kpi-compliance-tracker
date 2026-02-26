"use client"

import { useRouter } from "next/navigation"
import { CalendarDays } from "lucide-react"
import { formatDatePtBr } from "@/lib/utils"
import type { ActionPlanListRow } from "./actions-list"

function statusPill(s?: string | null) {
  const v = (s || "").toLowerCase()
  if (v === "done") return "bg-risk-low/10 text-risk-low border-risk-low/20"
  if (v === "blocked") return "bg-risk-critical/10 text-risk-critical border-risk-critical/20"
  if (v === "in_progress") return "bg-primary/10 text-primary border-primary/20"
  return "bg-background text-text-secondary border-border"
}

function statusLabel(s?: string | null) {
  const v = (s || "").toLowerCase()
  if (v === "done") return "Concluído"
  if (v === "blocked") return "Bloqueado"
  if (v === "in_progress") return "Em andamento"
  return "A fazer"
}

function priorityPill(p?: string | null) {
  const v = (p || "").toLowerCase()
  if (v === "critical") return "bg-risk-critical/10 text-risk-critical border border-risk-critical/20"
  if (v === "high") return "bg-risk-high/10 text-risk-high border border-risk-high/20"
  if (v === "medium") return "bg-risk-medium/10 text-risk-medium border border-risk-medium/20"
  if (v === "low") return "bg-risk-low/10 text-risk-low border border-risk-low/20"
  return "bg-background text-text-secondary border-border"
}

function safeDate(v?: string | null) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function isOverdue(row: ActionPlanListRow) {
  const d = safeDate(row.due_date ?? null)
  if (!d) return false
  const status = (row.status || "").toLowerCase()
  if (status === "done") return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dd = new Date(d)
  dd.setHours(0, 0, 0, 0)
  return dd.getTime() < today.getTime()
}

function initialsFromName(name: string) {
  const clean = name.trim()
  if (!clean) return "—"
  const parts = clean.split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? ""
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
  const out = (a + b).toUpperCase()
  return out || clean.slice(0, 2).toUpperCase()
}

function sanitizeActionDescription(description?: string | null) {
  const clean = description?.trim()
  if (!clean) return null
  const bulletSegments = clean.split("•").map((s) => s.trim()).filter(Boolean)
  if (bulletSegments.length > 1) {
    const filtered = bulletSegments.filter((segment) => !/respons[aá]vel/i.test(segment))
    const joined = filtered.join(" • ").trim()
    return joined || null
  }
  const withoutResponsible = clean
    .replace(/\s*(?:[-|]\s*)?respons[aá]vel(?:\s+pela\s+execu[cç][aã]o)?\s*:\s*.+$/i, "")
    .trim()
  return withoutResponsible || null
}

export default function ActionPlansTable({
  rows,
  page,
  perPage,
  total,
  showingFrom,
  showingTo,
}: {
  rows: ActionPlanListRow[]
  page: number
  perPage: number
  total: number
  showingFrom: number
  showingTo: number
}) {
  const router = useRouter()

  return (
    <div className="overflow-hidden rounded-xl border border-[#E6ECF5] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[#F2F6FF] border-b border-slate-200 dark:border-slate-800">
              <th className="ui-table-th px-4 py-3">Ação e descrição</th>
              <th className="ui-table-th px-4 py-3">Responsável</th>
              <th className="ui-table-th px-4 py-3">Prazo</th>
              <th className="ui-table-th px-4 py-3">Progresso</th>
              <th className="ui-table-th px-4 py-3">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E6ECF5] text-sm text-[#0F172A]">
            {rows.length === 0 ? (
              <tr>
                <td className="px-6 py-8 text-sm text-[#475569]" colSpan={5}>
                  Nenhum plano de ação encontrado.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const progress = Math.max(0, Math.min(100, r.progress_percent ?? 0))
                const overdueRow = isOverdue(r)
                const realDescription = sanitizeActionDescription(r.description)
                const responsibleName = r.responsible_name?.trim() || "—"

                const fallbackDesc = r.execution_id ? (
                  <>
                    {r.control_code ?? "—"} • {r.kpi_code ?? "—"} • auto: {r.auto_status ?? "—"} • wf:{" "}
                    {r.workflow_status ?? "—"}
                  </>
                ) : r.risk_id ? (
                  <>
                    risco: {r.risk_title ?? "—"} • class: {r.risk_classification ?? "—"}
                  </>
                ) : (
                  <>origem: —</>
                )

                return (
                  <tr
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/action-plans/${r.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        router.push(`/action-plans/${r.id}`)
                      }
                    }}
                    aria-label={`Abrir plano de ação ${r.title}`}
                    className="cursor-pointer transition-colors hover:bg-[rgba(6,182,212,0.08)]"
                  >
                    <td className="px-6 py-5">
                      <div className="max-w-[520px]">
                        <div className="mb-1 flex items-center gap-2">
                          <p className="font-bold text-[#0F172A]">{r.title}</p>
                          {overdueRow ? (
                            <span className="inline-flex items-center rounded-full border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.14)] px-2 py-0.5 text-[11px] font-bold text-[#EF4444]">
                              Atrasado
                            </span>
                          ) : null}
                        </div>

                        <p className="line-clamp-1 text-xs text-[#475569]">
                          {realDescription ? realDescription : fallbackDesc}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(6,182,212,0.12)] text-xs font-bold text-[#06B6D4]">
                          {responsibleName === "—" ? "—" : initialsFromName(responsibleName)}
                        </div>
                        <span className="font-medium text-[#475569]">{responsibleName}</span>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div
                        className={`flex items-center gap-1.5 ${
                          overdueRow ? "font-semibold text-[#EF4444]" : "text-[#475569]"
                        }`}
                      >
                        <CalendarDays className="h-4 w-4 opacity-70" />
                        {formatDatePtBr(r.due_date)}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="w-full max-w-[140px]">
                        <div className="mb-1 flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold ${
                              progress >= 100
                                ? "text-[#10B981]"
                                : progress >= 60
                                  ? "text-[#06B6D4]"
                                  : progress > 0
                                    ? "text-[#F59E0B]"
                                    : "text-[#64748B]"
                            }`}
                          >
                            {progress}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[rgba(6,182,212,0.12)]">
                          <div
                            className="h-full rounded-full bg-[#06B6D4]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${statusPill(
                          r.status
                        )}`}
                        title={r.status ?? ""}
                      >
                        {statusLabel(r.status)}
                      </span>

                      <div className="mt-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${priorityPill(
                            r.priority
                          )}`}
                          title={r.priority ?? ""}
                        >
                          {r.priority ?? "—"}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-[#E6ECF5] bg-[#F6F8FC] px-6 py-4">
        <span className="text-xs font-medium text-[#475569]">
          Mostrando {showingFrom}–{showingTo} de {total} resultados
        </span>

        <div className="flex items-center gap-2">
          <button
            className="cursor-not-allowed rounded border border-[#E6ECF5] bg-white px-3 py-1 text-xs font-bold text-[#64748B]"
            disabled
          >
            Anterior
          </button>

          <button className="rounded border border-[#06B6D4] bg-[#06B6D4] px-3 py-1 text-xs font-bold text-white">
            {page}
          </button>

          {total > perPage ? (
            <>
              <button className="rounded border border-[#E6ECF5] bg-white px-3 py-1 text-xs font-bold text-[#475569] transition-colors hover:bg-[rgba(6,182,212,0.08)] hover:text-[#06B6D4]">
                2
              </button>
              <button className="rounded border border-[#E6ECF5] bg-white px-3 py-1 text-xs font-bold text-[#475569] transition-colors hover:bg-[rgba(6,182,212,0.08)] hover:text-[#06B6D4]">
                3
              </button>
            </>
          ) : null}

          <button
            type="button"
            className="rounded border border-[#E6ECF5] bg-white px-3 py-1 text-xs font-bold text-[#475569] transition-colors hover:bg-[rgba(6,182,212,0.08)] hover:text-[#06B6D4]"
            title="Próximo (placeholder)"
          >
            Próximo
          </button>
        </div>
      </div>
    </div>
  )
}


