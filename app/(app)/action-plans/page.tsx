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
  if (v === "done") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (v === "blocked") return "bg-red-50 text-red-700 border-red-200"
  if (v === "in_progress") return "bg-primary/10 text-primary border-primary/20"
  return "bg-slate-50 text-slate-700 border-slate-200"
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
  if (v === "critical") return "bg-red-50 text-red-700 border-red-200"
  if (v === "high") return "bg-amber-50 text-amber-700 border-amber-200"
  if (v === "medium") return "bg-yellow-50 text-yellow-700 border-yellow-200"
  if (v === "low") return "bg-slate-50 text-slate-700 border-slate-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
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
              <div className="text-sm text-slate-500">
                Gerencie e monitore as ações de mitigação de riscos e conformidade.
              </div>

              {riskId ? (
                <div className="text-xs text-slate-500">
                  Filtrando por risco: <span className="font-mono">{riskId}</span>{" "}
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
          <div className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <ClipboardList className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-slate-400">{total > 0 ? "Ativo" : "—"}</span>
            </div>
            <p className="text-sm font-medium text-slate-500">Total de Planos</p>
            <p className="text-2xl font-bold text-slate-800">{total}</p>
          </div>

          <div className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-amber-100 p-2 text-amber-700">
                <Timer className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-amber-700">Em foco</span>
            </div>
            <p className="text-sm font-medium text-slate-500">Em Andamento</p>
            <p className="text-2xl font-bold text-slate-800">{inProgress}</p>
          </div>

          <div className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-red-100 p-2 text-red-700">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-red-700">Atenção</span>
            </div>
            <p className="text-sm font-medium text-slate-500">Planos Atrasados</p>
            <p className="text-2xl font-bold text-slate-800">{overdue}</p>
          </div>

          <div className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <BadgeCheck className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-emerald-700">Performance</span>
            </div>
            <p className="text-sm font-medium text-slate-500">Índice de Compliance</p>
            <p className="text-2xl font-bold text-slate-800">{complianceLabel}</p>
            <p className="mt-1 text-[11px] text-slate-400">Baseado em % concluído (placeholder).</p>
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
        <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-primary/10 bg-slate-50/60">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Ação &amp; Descrição
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Responsável
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Prazo
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Progresso
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-primary/5">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-sm text-slate-500" colSpan={6}>
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
                      <tr key={r.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-6 py-5">
                          <div className="max-w-[520px]">
                            <div className="mb-1 flex items-center gap-2">
                              <p className="font-bold text-slate-800">{r.title}</p>
                              {overdueRow ? (
                                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                                  Atrasado
                                </span>
                              ) : null}
                            </div>

                            <p className="line-clamp-1 text-xs text-slate-500">
                              {realDescription ? realDescription : fallbackDesc}
                            </p>

                            <p className="mt-1 text-[11px] text-slate-400">upd: {r.updated_at}</p>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                              {responsibleName === "—" ? "—" : initialsFromName(responsibleName)}
                            </div>
                            <span className="text-sm font-medium text-slate-700">{responsibleName}</span>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div
                            className={`flex items-center gap-1.5 text-sm ${
                              overdueRow ? "text-red-700 font-semibold" : "text-slate-600"
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
                                    ? "text-emerald-700"
                                    : progress >= 60
                                      ? "text-primary"
                                      : progress > 0
                                        ? "text-amber-700"
                                        : "text-slate-400"
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
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
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
          <div className="flex items-center justify-between border-t border-primary/10 bg-slate-50/40 px-6 py-4">
            <span className="text-xs font-medium text-slate-500">
              Mostrando {showingFrom}–{showingTo} de {total} resultados
            </span>

            <div className="flex items-center gap-2">
              <button
                className="rounded border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-400 cursor-not-allowed"
                disabled
              >
                Anterior
              </button>

              <button className="rounded border border-primary bg-primary px-3 py-1 text-xs font-bold text-white">
                {page}
              </button>

              {total > perPage ? (
                <>
                  <button className="rounded border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500 hover:bg-primary/5 hover:text-primary transition-colors">
                    2
                  </button>
                  <button className="rounded border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500 hover:bg-primary/5 hover:text-primary transition-colors">
                    3
                  </button>
                </>
              ) : null}

              <button
                className="rounded border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500 hover:bg-primary/5 hover:text-primary transition-colors"
                title="Próximo (placeholder)"
              >
                Próximo
              </button>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Dica: se você submeter uma execução com auto_status <b>warning/out_of_target</b> ou se o GRC marcar{" "}
          <b>needs_changes/rejected</b>, deve nascer/garantir um action plan aqui. (E futuramente: planos também podem
          nascer de riscos.)
        </div>
      </div>
    </PageContainer>
  )
}
