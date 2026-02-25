// app/(app)/controles/[id]/page.tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import PageContainer from "../../PageContainer"
import PageHeader from "../../PageHeader"
import { fetchControlById, fetchActionPlansForControlByMonth } from "./actions"
import type { ControlKpiSummaryRow } from "./actions"
import { fetchControlHistory } from "./history-actions"
import type { ControlHistoryItem } from "./history-actions"
import {
  ArrowLeft,
  CircleAlert,
  FileText,
  Pencil,
  ShieldAlert,
  Target,
  Settings2,
  Plus,
  Trash2,
  PencilLine,
} from "lucide-react"

type ActionPlanRow = {
  id: string
  title: string
  status: string | null
  priority: string | null
  due_date: string | null
  updated_at: string | null

  kpi_id: string | null
  kpi_code: string | null
  kpi_name: string | null

  execution_id: string | null
  execution_period_start: string | null
}

function riskBadge(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("critical"))
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800"
  if (s.includes("high"))
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
  if (s.includes("med") || s.includes("moderate") || s.includes("medium"))
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800"
  if (s.includes("low"))
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
}

function kpiStatusBadge(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (
    s.includes("in_target") ||
    s.includes("in target") ||
    s.includes("ok") ||
    s.includes("green") ||
    s.includes("effective") ||
    s.includes("pass")
  )
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
  if (
    s.includes("warning") ||
    s.includes("warn") ||
    s.includes("yellow") ||
    s.includes("medium") ||
    s.includes("moderate")
  )
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  if (
    s === "out" ||
    s.includes("out_of_target") ||
    s.includes("out of target") ||
    s.includes("critical") ||
    s.includes("gap") ||
    s.includes("red") ||
    s.includes("fail")
  )
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
}

function controlPeriodBadge(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s === "effective")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
  if (s === "warning")
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  if (s === "critical")
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  if (s === "overdue")
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
  if (s === "pending")
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
  if (s === "not_applicable")
    return "bg-slate-50 text-slate-500 dark:bg-slate-900/30 dark:text-slate-500 border border-slate-200 dark:border-slate-800"
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
}

function controlPeriodLabel(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s === "effective") return "EFFECTIVE"
  if (s === "warning") return "WARNING"
  if (s === "critical") return "CRITICAL"
  if (s === "pending") return "PENDING"
  if (s === "overdue") return "OVERDUE"
  if (s === "not_applicable") return "NOT APPLICABLE"
  return (v || "—").toUpperCase()
}

function pickFirst(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

function initials(name?: string | null) {
  const n = (name || "").trim()
  if (!n) return "—"
  const parts = n.split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase()).join("")
}

function formatMonthLabel(yyyyMm: string) {
  if (!/^\d{4}-\d{2}$/.test(yyyyMm)) return yyyyMm
  const [y, m] = yyyyMm.split("-").map((v) => Number(v))
  if (!y || !m || m < 1 || m > 12) return yyyyMm
  const monthsPt = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${monthsPt[m - 1]}/${y}`
}

function currentYYYYMM() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === "year")?.value ?? ""
  const m = parts.find((p) => p.type === "month")?.value ?? ""
  return `${y}-${m}`
}

function actionLabel(action?: string | null) {
  const a = (action || "").toLowerCase()
  if (a === "created") return "Criado"
  if (a === "updated") return "Atualizado"
  if (a === "deleted") return "Removido"
  if (a === "kpi_config_updated") return "Configuração do KPI"
  if (a === "kpi_created") return "KPI criado"
  if (a === "kpi_updated") return "KPI atualizado"
  return (action || "Evento").toUpperCase()
}

/** ✅ ícone + cor por evento */
function historyDotBg(action?: string | null) {
  const a = (action || "").toLowerCase()
  if (a.includes("deleted")) return "bg-red-600"
  if (a.includes("created")) return "bg-emerald-600"
  if (a.includes("kpi_config")) return "bg-amber-500"
  if (a.includes("updated")) return "bg-blue-600"
  return "bg-slate-500"
}

function historyIcon(h: ControlHistoryItem) {
  const a = (h.action || "").toLowerCase()
  const e = (h.entity_type || "").toLowerCase()

  if (a.includes("kpi_config")) return Settings2
  if (a.includes("deleted")) return Trash2
  if (a.includes("created")) return Plus
  if (a.includes("updated")) return PencilLine

  if (e === "kpi") return Target
  if (e === "control") return ShieldAlert
  return FileText
}

export default async function ControleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = (await searchParams) ?? {}
  const tab = (pickFirst(sp.tab) ?? "kpis").toLowerCase()

  const mes_ref = pickFirst(sp.mes_ref) ?? currentYYYYMM()

  let data: Awaited<ReturnType<typeof fetchControlById>> | null = null
  try {
    data = await fetchControlById(id, mes_ref)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes("não existe") || msg.toLowerCase().includes("tenant")) return notFound()
    throw err
  }

  const { control, kpis, months, mes_ref_used, control_period_status } = data

  let history: ControlHistoryItem[] = []
  try {
    history = await fetchControlHistory(id)
  } catch {
    history = []
  }

  // ✅ action plans (somente quando tab=plans)
  let actionPlans: ActionPlanRow[] = []
  if (tab === "plans") {
    try {
      actionPlans = (await fetchActionPlansForControlByMonth(control.id, mes_ref_used)) as any
    } catch {
      actionPlans = []
    }
  }

  const tabHref = (next: string) =>
    `/controles/${control.id}?tab=${next}&mes_ref=${encodeURIComponent(mes_ref_used)}`

  const controlOwnerName: string | null = control.control_owner_name || control.control_owner_email || null
  const focalPointName: string | null = control.focal_point_name || control.focal_point_email || null

  const riskTitle = control.risk_name && control.risk_name.trim() ? control.risk_name : null
  const riskDesc = control.risk_description && control.risk_description.trim() ? control.risk_description : null

  return (
    <PageContainer variant="default">
      <div className="space-y-6">
        <PageHeader
          title={control.name}
          description={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500 font-mono">{control.control_code}</span>

              <span className={`px-3 py-1 text-xs font-bold rounded-full ${riskBadge(control.risk_level)}`}>
                {(control.risk_level || "risco não definido").toUpperCase()}
              </span>

              <span
                className={`px-3 py-1 text-xs font-bold rounded-full ${controlPeriodBadge(control_period_status)}`}
                title="Status agregado do controle no mês selecionado"
              >
                {controlPeriodLabel(control_period_status)}
              </span>

              <span
                className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border"
                style={{ borderColor: "var(--highlight)" }}
                title="Mês de referência selecionado"
              >
                PERÍODO: {formatMonthLabel(mes_ref_used)}
              </span>
            </div>
          }
          right={
            <>
              <Link
                href={`/controles?mes_ref=${encodeURIComponent(mes_ref_used)}`}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border bg-white hover:bg-slate-50"
                title="Voltar"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Link>

              <Link
                href={`/controles/${control.id}/editar`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors text-sm"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </Link>
            </>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          {/* LEFT */}
          <div className="lg:col-span-7 space-y-6">
            {/* Summary card */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Control Owner</span>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-100 grid place-items-center">
                      <span className="text-[11px] font-bold text-slate-600">{initials(controlOwnerName)}</span>
                    </div>
                    <span className="text-sm font-medium text-slate-700">{controlOwnerName ?? "—"}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Focal Point</span>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[11px] font-bold text-blue-600">
                      {initials(focalPointName) === "—" ? "—" : initials(focalPointName)}
                    </div>
                    <span className="text-sm font-medium text-slate-700">{focalPointName ?? "—"}</span>
                  </div>
                </div>

                {/* Período */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Período</span>

                  <form method="get" className="flex items-center gap-2">
                    <input type="hidden" name="tab" value={tab} />

                    <select
                      name="mes_ref"
                      defaultValue={mes_ref_used}
                      className="h-10 w-full px-3 rounded-lg text-sm bg-white border border-slate-200 text-slate-900
                                 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      title="Selecionar mês de referência"
                    >
                      {months.map((m) => (
                        <option key={m} value={m}>
                          {formatMonthLabel(m)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="submit"
                      className="h-10 px-3 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50"
                      title="Aplicar período"
                    >
                      Aplicar
                    </button>
                  </form>
                </div>

                <div className="hidden sm:block" />
              </div>

              <div className="mt-4 text-xs text-slate-400">
                Dica: o <b>Período</b> controla o resultado/status exibidos para cada KPI no mês selecionado.
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex border-b border-slate-200 px-4">
                <Link
                  href={tabHref("kpis")}
                  className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
                    tab === "kpis" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-primary"
                  }`}
                >
                  KPIs
                </Link>

                <Link
                  href={tabHref("plans")}
                  className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    tab === "plans" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-primary"
                  }`}
                >
                  Planos de Ação
                </Link>

                <Link
                  href={tabHref("history")}
                  className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    tab === "history"
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-500 hover:text-primary"
                  }`}
                >
                  Histórico
                </Link>
              </div>

              {/* CONTENT */}
              {tab === "kpis" ? (
                <div className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-[#F2F6FF] border-b border-slate-100">
                          <th className="ui-table-th px-4 py-3">Nome do KPI</th>
                          <th className="ui-table-th px-4 py-3">Meta</th>
                          <th className="ui-table-th px-4 py-3">Resultado (período)</th>
                          <th className="ui-table-th px-4 py-3">Status (período)</th>
                        </tr>
                      </thead>

                      <tbody className="ui-table-tbody divide-y divide-slate-100">
                        {kpis.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8">
                              <div className="text-sm text-slate-500">Nenhum KPI associado a este controle ainda.</div>
                              <div className="text-xs text-slate-400 mt-1">
                                Quando você vincular KPIs ao controle, eles aparecem aqui.
                              </div>
                            </td>
                          </tr>
                        ) : (
                          kpis.map((k: ControlKpiSummaryRow) => (
                            <tr key={k.kpi_id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <Link
                                  href={`/kpis/${k.kpi_id}?mes_ref=${encodeURIComponent(mes_ref_used)}&from=controle`}
                                  className="inline-flex flex-col hover:underline"
                                  title="Abrir detalhe do KPI"
                                >
                                  <span className="font-medium text-slate-700">{k.kpi_name}</span>
                                  <div className="text-xs text-slate-500 mt-0.5">{k.kpi_code}</div>
                                </Link>
                              </td>

                              <td className="px-4 py-3 text-slate-600">
                                {k.target_value === null || k.target_value === undefined ? "—" : String(k.target_value)}
                              </td>

                              <td className="px-4 py-3 text-sm font-semibold">
                                {k.period_result === null ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-slate-100 text-slate-600">
                                    PENDENTE
                                  </span>
                                ) : (
                                  <span className="text-slate-700">{k.period_result}</span>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${kpiStatusBadge(
                                    k.period_auto_status
                                  )}`}
                                  title={k.period_end ? `period_end=${k.period_end}` : "sem execução no mês"}
                                >
                                  {k.period_auto_status ?? "pendente"}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : tab === "plans" ? (
                <div className="p-0">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CircleAlert className="w-4 h-4 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-800">Planos de Ação</h3>
                    </div>

                    <div className="text-xs text-slate-400">
                      Período: <span className="font-semibold text-slate-600">{formatMonthLabel(mes_ref_used)}</span>
                    </div>
                  </div>

                  {actionPlans.length === 0 ? (
                    <div className="px-4 py-8 text-sm text-slate-500">
                      Nenhum plano de ação encontrado para este controle neste período.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-[#F2F6FF] border-b border-slate-100">
                            <th className="ui-table-th px-4 py-3">KPI</th>
                            <th className="ui-table-th px-4 py-3">Plano</th>
                            <th className="ui-table-th px-4 py-3">Prioridade</th>
                            <th className="ui-table-th px-4 py-3">Status</th>
                            <th className="ui-table-th px-4 py-3">Data de vencimento</th>
                            <th className="ui-table-th px-4 py-3">Atualizado</th>
                          </tr>
                        </thead>

                        <tbody className="ui-table-tbody divide-y divide-slate-100">
                          {actionPlans.map((ap) => (
                            <tr key={ap.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                {ap.kpi_id ? (
                                  <Link
                                    href={`/kpis/${ap.kpi_id}?mes_ref=${encodeURIComponent(mes_ref_used)}&from=controle`}
                                    className="inline-flex flex-col hover:underline"
                                    title="Abrir detalhe do KPI"
                                  >
                                    <span className="text-sm font-medium text-slate-700">{ap.kpi_name ?? "KPI"}</span>
                                    <span className="text-xs text-slate-500 mt-0.5">{ap.kpi_code ?? ""}</span>
                                  </Link>
                                ) : (
                                  <span className="text-sm text-slate-500">—</span>
                                )}

                                {ap.execution_id && ap.execution_period_start === mes_ref_used ? (
                                  <div className="mt-1 text-[11px] font-semibold text-emerald-700">Vinculado ao período</div>
                                ) : ap.execution_id ? (
                                  <div className="mt-1 text-[11px] font-semibold text-amber-700">
                                    Vínculo em outro período ({ap.execution_period_start ?? "—"})
                                  </div>
                                ) : (
                                  <div className="mt-1 text-[11px] font-semibold text-slate-400">Sem vínculo à execução</div>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <span className="font-medium text-slate-800">{ap.title}</span>
                                <div className="text-xs text-slate-400 mt-0.5 font-mono">{ap.id}</div>
                              </td>

                              <td className="px-4 py-3 text-slate-700">{ap.priority ?? "—"}</td>

                              <td className="px-4 py-3 text-slate-700">{ap.status ?? "—"}</td>

                              <td className="px-4 py-3 text-slate-700">
                                {ap.due_date ? new Date(ap.due_date).toLocaleDateString("pt-BR") : "—"}
                              </td>

                              <td className="px-4 py-3 text-slate-500">
                                {ap.updated_at ? new Date(ap.updated_at).toLocaleString("pt-BR") : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-4">
                    Histórico de Alterações
                  </h3>

                  <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                    {history.length === 0 ? (
                      <div className="text-sm text-slate-500">Nenhum evento registrado ainda.</div>
                    ) : (
                      history.map((h) => {
                        const Icon = historyIcon(h)
                        return (
                          <div key={h.id} className="relative pl-8">
                            <div
                              className={`absolute left-0 top-1.5 w-6 h-6 rounded-full ${historyDotBg(
                                h.action
                              )} flex items-center justify-center ring-4 ring-white`}
                              title={`${h.entity_type} • ${h.action}`}
                            >
                              <Icon className="w-3.5 h-3.5 text-white" />
                            </div>

                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-800">{h.summary}</span>

                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-500">
                                  {h.actor ? (
                                    <>
                                      {actionLabel(h.action)} por <strong>{h.actor}</strong>
                                    </>
                                  ) : (
                                    <>Sistema</>
                                  )}
                                </span>

                                <span className="text-[10px] text-slate-400">•</span>

                                <span className="text-xs text-slate-400">
                                  {new Date(h.created_at).toLocaleString("pt-BR")}
                                </span>

                                <span className="text-[10px] text-slate-300">•</span>

                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                                  {String(h.entity_type || "event")}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <p className="text-sm text-slate-500 mt-6">
                    Dica: aqui a timeline já diferencia ações (criado/atualizado/removido/config) e tipo de entidade (control/kpi).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-5">
              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">ID do Controle</h3>
                <p className="text-sm font-mono font-medium text-primary">{control.control_code}</p>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Frequência</h3>
                <p className="text-sm font-medium text-slate-700">{control.frequency ?? "—"}</p>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Nome do Controle</h3>
                <p className="text-sm font-semibold text-slate-800">{control.name}</p>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Descrição</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{control.description?.trim() ? control.description : "—"}</p>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Objetivo</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{control.goal?.trim() ? control.goal : "—"}</p>
              </div>
            </div>

            <div
              className="border border-slate-200 rounded-xl p-4 space-y-5"
              style={{ backgroundColor: "var(--primary)", color: "white" }}
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" style={{ color: "white" }} />
                <h2 className="text-sm font-semibold">Risco Associado</h2>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.75)" }}>
                  ID do Risco
                </h3>
                <p className="text-sm font-mono font-semibold">{control.risk_id ?? "—"}</p>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.75)" }}>
                  Título do Risco
                </h3>
                <p className="text-sm font-semibold">{riskTitle ?? "—"}</p>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.75)" }}>
                  Descrição do Risco
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
                  {riskDesc ?? "—"}
                </p>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.75)" }}>
                  Classificação
                </h3>
                <p className="text-sm font-semibold">{control.risk_level ?? "—"}</p>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.75)" }}>
                  Framework
                </h3>
                <p className="text-sm font-medium">{control.framework ?? "—"}</p>
              </div>
            </div>

            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              title="Excluir (placeholder)"
            >
              <ShieldAlert className="w-4 h-4" />
              Excluir Controle
            </button>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              Criado em: <span className="text-slate-500">{control.created_at}</span>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}