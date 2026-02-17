import Link from "next/link"
import { notFound } from "next/navigation"
import PageContainer from "../../PageContainer"
import PageHeader from "../../PageHeader"
import { fetchControlById } from "../actions-detail"
import type { ControlKpiRow } from "../actions-detail"
import {
  ArrowLeft,
  CalendarDays,
  CircleAlert,
  FileUp,
  FileText,
  Pencil,
  ShieldAlert,
} from "lucide-react"

type ActionPlanRow = {
  id: string
  title: string
  status: string | null
  priority: string | null
  due_date: string | null
  updated_at: string | null
}

function riskBadge(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("critical"))
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800"
  if (s.includes("high"))
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
  if (s.includes("med") || s.includes("moderate"))
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800"
  if (s.includes("low"))
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
}

function kpiStatusBadge(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("in_target") || s.includes("in target") || s.includes("ok"))
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
  if (s.includes("warning") || s.includes("warn"))
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  // ✅ ajuste: no seu banco o enum é "out" (não "out_of_target")
  if (s === "out" || s.includes("out_of_target") || s.includes("out of target") || s.includes("critical"))
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
}

function controlPeriodBadge(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s === "effective")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
  if (s === "gap")
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  if (s === "out_of_standard")
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  if (s === "not_executed")
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
}

function controlPeriodLabel(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s === "effective") return "EFFECTIVE"
  if (s === "gap") return "GAP"
  if (s === "out_of_standard") return "OUT"
  if (s === "not_executed") return "NOT EXECUTED"
  return (v || "—").toUpperCase()
}

function formatTarget(op?: string | null, val?: number | null) {
  if (!op && (val === null || val === undefined)) return "—"
  if (!op && val !== null && val !== undefined) return String(val)
  if (op && (val === null || val === undefined)) return op
  return `${op} ${val}`
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

function formatPeriodLabel(periodEnd?: string | null) {
  if (!periodEnd) return "—"
  // esperado: YYYY-MM-DD
  const [y, m, d] = periodEnd.split("-")
  if (!y || !m || !d) return periodEnd
  return `${d}/${m}/${y}`
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

  // ✅ novo: período opcional via querystring (?period=YYYY-MM-DD)
  const period = pickFirst(sp.period) ?? null

  let data: Awaited<ReturnType<typeof fetchControlById>> | null = null
  try {
    // ✅ chama com o período (se vier). Se não vier, a action usa o último período existente.
    data = await fetchControlById(id, period)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes("não existe") || msg.toLowerCase().includes("tenant")) return notFound()
    throw err
  }

  const { control, kpis, period_end_used, control_period_status } = data

  const actionPlans: ActionPlanRow[] = []
  const tabHref = (next: string) => `/controles/${control.id}?tab=${next}${period_end_used ? `&period=${period_end_used}` : ""}`

  const controlOwnerName: string | null = null
  const focalPointName: string | null = null

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

              {/* ✅ novo: status agregado do controle no período */}
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full ${controlPeriodBadge(control_period_status)}`}
                title="Status agregado do controle no período"
              >
                {controlPeriodLabel(control_period_status)}
              </span>

              {/* ✅ novo: período usado */}
              <span
                className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                title="Período de referência (period_end) usado para os KPIs"
              >
                PERÍODO: {formatPeriodLabel(period_end_used)}
              </span>
            </div>
          }
          right={
            <>
              <Link
                href="/controles"
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

                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Frequência</span>
                  <div className="flex items-center gap-2 mt-1">
                    <CalendarDays className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">{control.frequency ?? "—"}</span>
                  </div>
                </div>

                {/* ✅ novo: período no summary */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Período</span>
                  <div className="flex items-center gap-2 mt-1">
                    <CalendarDays className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">{formatPeriodLabel(period_end_used)}</span>
                  </div>
                </div>
              </div>

              {/* ✅ dica/UX simples (sem virar form agora) */}
              <div className="mt-4 text-xs text-slate-400">
                Dica: você pode abrir este detalhe com <span className="font-mono">?period=YYYY-MM-DD</span> para ver o status dos KPIs naquele mês.
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
                    tab === "history" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-primary"
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
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Nome do KPI</th>
                          <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Meta</th>
                          <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Resultado (período)</th>
                          <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Status (período)</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {kpis.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8">
                              <div className="text-sm text-slate-500">Nenhum KPI associado a este controle ainda.</div>
                              <div className="text-xs text-slate-400 mt-1">
                                Quando você vincular KPIs ao controle, eles aparecem aqui (independente de haver execução).
                              </div>
                            </td>
                          </tr>
                        ) : (
                          kpis.map((k: ControlKpiRow) => (
                            <tr key={k.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <span className="text-sm font-medium text-slate-700">{k.name}</span>
                                <div className="text-xs text-slate-500 mt-0.5">{k.kpi_code}</div>
                              </td>

                              <td className="px-4 py-3 text-sm text-slate-600">{formatTarget(k.target_operator, k.target_value)}</td>

                              <td className="px-4 py-3 text-sm font-semibold text-slate-700">{k.last_result_numeric ?? "—"}</td>

                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${kpiStatusBadge(
                                    k.last_auto_status
                                  )}`}
                                  title={k.last_period_end ? `period_end=${k.last_period_end}` : "sem execução no período"}
                                >
                                  {k.last_auto_status ?? "—"}
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
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <CircleAlert className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-800">Planos de Ação</h3>
                  </div>

                  {actionPlans.length === 0 ? (
                    <div className="px-4 py-8 text-sm text-slate-500">Nenhum plano de ação encontrado para este controle.</div>
                  ) : null}
                </div>
              ) : (
                <div className="p-4">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-4">
                    Histórico de Alterações
                  </h3>

                  <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                    <div className="relative pl-8">
                      <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-primary flex items-center justify-center ring-4 ring-white">
                        <FileUp className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-800">
                          Placeholder: evidência enviada (audit event)
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">
                            Enviado por <strong>—</strong>
                          </span>
                          <span className="text-[10px] text-slate-400">•</span>
                          <span className="text-xs text-slate-400">—</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-500 mt-6">
                    Para ficar 100% como o template com dados reais, a gente cria/usa uma tabela de eventos (ex:{" "}
                    <span className="font-mono">audit_events</span>) e lista aqui.
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
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Nome do Controle</h3>
                <p className="text-sm font-semibold text-slate-800">{control.name}</p>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Descrição</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Placeholder: quando você adicionar campos de descrição/objetivo no banco, exibimos aqui.
                </p>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Objetivo</h3>
                <p className="text-sm text-slate-600 leading-relaxed">Placeholder: objetivo do controle.</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-semibold text-slate-800">Risco Associado</h2>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Classificação</h3>
                <p className="text-sm font-semibold text-slate-800">{control.risk_level ?? "—"}</p>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Framework</h3>
                <p className="text-sm font-medium text-slate-700">{control.framework ?? "—"}</p>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Frequência</h3>
                <p className="text-sm font-medium text-slate-700">{control.frequency ?? "—"}</p>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Quando você conectar o módulo de <span className="font-mono">risks</span>, a gente exibe aqui: ID, nome e
                descrição do risco (igual no template).
              </p>
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
