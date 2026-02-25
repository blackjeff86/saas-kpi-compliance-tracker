// app/(app)/action-plans/page.tsx
import Link from "next/link"
import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import ActionPlansFilters from "./ActionPlansFilters"
import {
  fetchActionPlans,
  fetchActionPlansFilterOptions,
  type ActionPlanListRow,
} from "./actions-list"
import { CalendarDays, ClipboardList, Timer, AlertTriangle, BadgeCheck } from "lucide-react"
import NewActionPlanModal from "./NewActionPlanModal"
import { fetchOriginOptions } from "./actions-create"

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
  return "bg-background text-text-secondary border border-border"
}

function safeDate(v?: string | null) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function formatPtBrDate(v?: string | null) {
  const d = safeDate(v)
  if (!d) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d)
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

  // Remove segmentos de responsável quando vierem concatenados na descrição.
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

function getQueryValue(
  searchParams: { [key: string]: string | string[] | undefined } | undefined,
  key: string
) {
  const raw = searchParams?.[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

type PageSearchParams = { [key: string]: string | string[] | undefined }

export default async function ActionPlansPage(props: {
  searchParams?: PageSearchParams | Promise<PageSearchParams | undefined>
}) {
  const searchParams = await props.searchParams

  const riskId = getQueryValue(searchParams, "risk")
  const framework = getQueryValue(searchParams, "framework")
  const responsible = getQueryValue(searchParams, "responsible")
  const status = getQueryValue(searchParams, "status")
  const priority = getQueryValue(searchParams, "priority")

  const [rows, filterOptions, originOptions] = await Promise.all([
    fetchActionPlans({ riskId, framework, responsible, status, priority }),
    fetchActionPlansFilterOptions(),
    fetchOriginOptions(),
  ])

  const total = rows.length
  const inProgress = rows.filter((r) => (r.status || "").toLowerCase() === "in_progress").length
  const overdue = rows.filter((r) => isOverdue(r)).length
  const done = rows.filter((r) => (r.status || "").toLowerCase() === "done").length

  const complianceIndex = total > 0 ? (done / total) * 100 : 0
  const complianceLabel = `${complianceIndex.toFixed(1)}%`

  // Paginação (UI placeholder)
  const page = 1
  const perPage = Math.max(total, 1)
  const showingFrom = total === 0 ? 0 : 1
  const showingTo = total

  return (
    <PageContainer variant="default">
      <div className="space-y-6">
        <PageHeader
          title="Planos de Ação"
          description={
            <div className="space-y-1">
              <div className="text-sm text-text-secondary">
                Gerencie e monitore as ações de mitigação de riscos e conformidade.
              </div>

              {riskId ? (
                <div className="text-xs text-text-muted">
                  Filtrando por risco{" "}
                  <Link className="underline" href="/action-plans">
                    limpar filtro
                  </Link>
                </div>
              ) : null}
            </div>
          }
          right={
            <div className="flex items-center gap-3">
              <NewActionPlanModal originOptions={originOptions} />
            </div>
          }
        />

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <ClipboardList className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-text-muted">{total > 0 ? "Ativo" : "—"}</span>
            </div>
            <p className="text-sm font-medium text-text-secondary">Total de Planos</p>
            <p className="text-2xl font-bold text-text-primary">{total}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-risk-high/10 p-2 text-risk-high">
                <Timer className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-risk-high">Em foco</span>
            </div>
            <p className="text-sm font-medium text-text-secondary">Em Andamento</p>
            <p className="text-2xl font-bold text-text-primary">{inProgress}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-risk-critical/10 p-2 text-risk-critical">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-risk-critical">Atenção</span>
            </div>
            <p className="text-sm font-medium text-text-secondary">Planos Atrasados</p>
            <p className="text-2xl font-bold text-text-primary">{overdue}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-risk-low/10 p-2 text-risk-low">
                <BadgeCheck className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-risk-low">Performance</span>
            </div>
            <p className="text-sm font-medium text-text-secondary">Índice de Compliance</p>
            <p className="text-2xl font-bold text-text-primary">{complianceLabel}</p>
            <p className="mt-1 text-[11px] text-text-muted">Baseado em % concluído (placeholder).</p>
          </div>
        </div>

        <ActionPlansFilters
          riskId={riskId}
          framework={framework}
          responsible={responsible}
          status={status}
          priority={priority}
          options={filterOptions}
        />

        {/* Main table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E6ECF5] bg-[#F2F6FF]">
                  <th className="ui-table-th px-6 py-4">Ação e descrição</th>
                  <th className="ui-table-th px-6 py-4">Responsável</th>
                  <th className="ui-table-th px-6 py-4">Prazo</th>
                  <th className="ui-table-th px-6 py-4">Progresso</th>
                  <th className="ui-table-th px-6 py-4">Status</th>
                  <th className="ui-table-th px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>

              <tbody className="ui-table-tbody divide-y divide-[#E6ECF5]">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-sm text-text-secondary" colSpan={6}>
                      Nenhum plano de ação encontrado.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const progress = Math.max(0, Math.min(100, r.progress_percent ?? 0))
                    const overdueRow = isOverdue(r)
                    const realDescription = sanitizeActionDescription(r.description)
                    const responsibleName = r.responsible_name?.trim() || "—"

                    const fallbackDesc =
                      r.execution_id ? (
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
                      <tr key={r.id} className="transition-colors hover:bg-primary/10/50">
                        <td className="px-6 py-5">
                          <div className="max-w-[520px]">
                            <div className="mb-1 flex items-center gap-2">
                              <p className="font-bold text-text-primary">{r.title}</p>
                              {overdueRow ? (
                                <span className="inline-flex items-center rounded-full border border-risk-critical/20 bg-risk-critical/10 px-2 py-0.5 text-[11px] font-bold text-risk-critical">
                                  Atrasado
                                </span>
                              ) : null}
                            </div>

                            <p className="line-clamp-1 text-xs text-text-secondary">
                              {realDescription ? realDescription : fallbackDesc}
                            </p>

                            <p className="mt-1 text-[11px] text-text-muted">upd: {r.updated_at}</p>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {responsibleName === "—" ? "—" : initialsFromName(responsibleName)}
                            </div>
                            <span className="font-medium text-text-secondary">{responsibleName}</span>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div
                            className={`flex items-center gap-1.5 ${
                              overdueRow ? "font-semibold text-risk-critical" : "text-text-secondary"
                            }`}
                          >
                            <CalendarDays className="h-4 w-4 opacity-70" />
                            {formatPtBrDate(r.due_date ?? null)}
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="w-full max-w-[140px]">
                            <div className="mb-1 flex items-center justify-between">
                              <span
                                className={`text-[10px] font-bold ${
                                  progress >= 100
                                    ? "text-risk-low"
                                    : progress >= 60
                                      ? "text-primary"
                                      : progress > 0
                                        ? "text-risk-high"
                                        : "text-text-muted"
                                }`}
                              >
                                {progress}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-primary/10">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
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

                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/action-plans/${r.id}`}
                               className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-bold text-text-primary transition-colors hover:bg-primary/10"
                              title="Ver detalhes do plano"
                            >
                              Detalhes
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination (UI placeholder) */}
          <div className="flex items-center justify-between border-t border-border bg-background px-6 py-4">
            <span className="text-xs font-medium text-text-secondary">
              Mostrando {showingFrom}–{showingTo} de {total} resultados
            </span>

            <div className="flex items-center gap-2">
              <button
                className="cursor-not-allowed rounded border border-border bg-white px-3 py-1 text-xs font-bold text-text-muted"
                disabled
              >
                Anterior
              </button>

              <button className="rounded border border-primary bg-primary px-3 py-1 text-xs font-bold text-white">
                {page}
              </button>

              {total > perPage ? (
                <>
                  <button className="rounded border border-border bg-white px-3 py-1 text-xs font-bold text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary">
                    2
                  </button>
                  <button className="rounded border border-border bg-white px-3 py-1 text-xs font-bold text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary">
                    3
                  </button>
                </>
              ) : null}

              <button
                className="rounded border border-border bg-white px-3 py-1 text-xs font-bold text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
                title="Próximo (placeholder)"
              >
                Próximo
              </button>
            </div>
          </div>
        </div>

        <div className="text-xs text-text-muted">
          Dica: se você submeter uma execução com auto_status <b>warning/out_of_target</b> ou se o GRC marcar{" "}
          <b>needs_changes/rejected</b>, deve nascer/garantir um action plan aqui. (E futuramente: planos também podem
          nascer de riscos.)
        </div>
      </div>
    </PageContainer>
  )
}
