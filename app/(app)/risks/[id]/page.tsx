import Link from "next/link"
import { notFound } from "next/navigation"
import PageContainer from "../../PageContainer"
import {
  fetchRiskById,
  type RiskAssessmentRow,
  type RiskActionPlanRow,
} from "../actions-detail"
import { addRiskAssessment } from "../actions-assessment"
import { fetchRisksFilterOptions } from "../actions"
import { fetchRiskHistory } from "../history-actions"
import { fetchRiskUpdates, addRiskUpdate } from "../actions-updates"
import {
  ArrowLeft,
  History,
  Pencil,
  ClipboardList,
  ShieldCheck,
  Info,
  Bolt,
  Link2,
  MessageSquare,
} from "lucide-react"
import AddActionPlanFromRiskModal from "../AddActionPlanFromRiskModal"
import EditRiskModal from "../EditRiskModal"
import RiskStatusDropdown from "../RiskStatusDropdown"
import { DEFAULT_SOURCES, DEFAULT_NATUREZAS } from "../constants"

function pillClass(v: string) {
  const s = (v || "").toLowerCase()
  if (s === "critical") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-900/40"
  if (s === "high") return "bg-orange-100 text-orange-800 dark:bg-orange-900/25 dark:text-orange-300 border-orange-200 dark:border-orange-900/40"
  if (s === "med") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/25 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/40"
  if (s === "low") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40"
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
}

function heatCellBg(score: number) {
  // score = impact * likelihood (1..25)
  if (score >= 20) return "bg-red-500/80 dark:bg-red-600/70"
  if (score >= 12) return "bg-orange-500/70 dark:bg-orange-600/60"
  if (score >= 6) return "bg-yellow-400/60 dark:bg-yellow-600/40"
  return "bg-emerald-400/50 dark:bg-emerald-600/35"
}

function safe15(v: unknown) {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  const i = Math.floor(n)
  if (i < 1 || i > 5) return null
  return i
}

function classifyScore(score: number) {
  if (score >= 20) return "critical"
  if (score >= 12) return "high"
  if (score >= 6) return "med"
  return "low"
}

export default async function RiskDetailPage(props: {
  params?: Promise<{ id?: string }> | { id?: string }
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const params = props.params instanceof Promise ? await props.params : props.params
  const id = params?.id
  if (!id || id === "undefined") notFound()

  const [data, filterOpts, history, updates] = await Promise.all([
    fetchRiskById(id),
    fetchRisksFilterOptions(),
    fetchRiskHistory(id),
    fetchRiskUpdates(id),
  ])
  const risk = data.risk
  const assessments: RiskAssessmentRow[] = data.assessments
  const actionPlans: RiskActionPlanRow[] = data.actionPlans
  const sources = [...new Set([...DEFAULT_SOURCES, ...filterOpts.sources])]
  const naturezas = [...new Set([...DEFAULT_NATUREZAS, ...filterOpts.naturezas])]

  const from = props.searchParams?.from
  const fromValue = Array.isArray(from) ? from[0] : from
  const cameFromActionPlans = fromValue === "action-plans"

  const returnTo = props.searchParams?.returnTo
  const returnToValue = Array.isArray(returnTo) ? returnTo[0] : returnTo
  const backToRisksHref = returnToValue && typeof returnToValue === "string" ? decodeURIComponent(returnToValue) : "/risks"

  const spRisk = props.searchParams?.risk
  const spRiskId = Array.isArray(spRisk) ? spRisk[0] : spRisk
  const riskIdForBackLink = spRiskId || risk.id

  async function onAddUpdate(formData: FormData) {
    "use server"
    await addRiskUpdate(risk.id, formData)
  }

  async function onAddAssessment(formData: FormData) {
    "use server"
    const impact = Number(formData.get("impact") || 1)
    const likelihood = Number(formData.get("likelihood") || 1)
    const notes = String(formData.get("notes") || "").trim()

    await addRiskAssessment({
      riskId: risk.id,
      impact,
      likelihood,
      notes: notes || undefined,
    })
  }


  // Impact/Likelihood atuais (catálogo ou risco “full”)
  const impact = safe15(risk.impact) ?? 1
  const likelihood = safe15(risk.likelihood) ?? 1
  const score = impact * likelihood
  const scoreClass = classifyScore(score)

  const backLinks = (
    <div className="text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
      {cameFromActionPlans ? (
        <>
          <Link href={`/action-plans?risk=${riskIdForBackLink}`} className="hover:underline">
            ← Voltar para planos filtrados
          </Link>
          <span className="text-slate-300 dark:text-slate-700">|</span>
        </>
      ) : null}

      <Link href={backToRisksHref} className="hover:underline">
        ← Voltar para riscos
      </Link>

      <span className="text-slate-300 dark:text-slate-700">|</span>

      <Link href={`/action-plans?risk=${risk.id}`} className="hover:underline">
        Ver planos de ação →
      </Link>

      {cameFromActionPlans ? (
        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-md border text-xs bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700">
          Vindo de Planos de Ação (filtro ativo)
        </span>
      ) : null}
    </div>
  )

  return (
    <PageContainer variant="default">
      <div className="space-y-6">
        {/* Top / Breadcrumb + ações */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            {backLinks}

            <div className="flex items-start gap-3">
              <Link
                href={backToRisksHref}
                className="mt-1 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                title="Voltar"
              >
                <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-200" />
              </Link>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">
                    {risk.title}
                  </h1>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${pillClass(risk.classification)}`}>
                    {risk.classification}
                  </span>
                </div>

                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono">
                    {risk.risk_code ?? risk.domain}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span>Atualizado: {risk.updated_at}</span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span>Criado: {risk.created_at}</span>
                </div>

                {risk.description ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 whitespace-pre-wrap">
                    {risk.description}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <EditRiskModal
              risk={{
                id: risk.id,
                title: risk.title,
                description: risk.description,
                risk_code: risk.risk_code,
                domain: risk.domain,
                classification: risk.classification,
                risk_source: risk.risk_source,
                natureza: risk.natureza,
                impact: impact,
                likelihood: likelihood,
              }}
              sources={sources}
              naturezas={naturezas}
            />
          </div>
        </div>

        {/* Layout principal: esquerda (2/3) + direita (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ESQUERDA */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações gerais */}
            <section className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-slate-900 dark:text-white">Informações Gerais</h2>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fonte</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {risk.risk_source ?? "—"}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Natureza</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {risk.natureza ?? "—"}
                    </div>
                  </div>
                </div>

                {risk.source === "full" ? (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status / Owner</div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <RiskStatusDropdown riskId={risk.id} currentStatus={risk.status ?? "open"} />
                      <span className="text-sm text-slate-700 dark:text-slate-200">
                        Owner: <span className="font-semibold">{risk.owner_name ?? "—"}</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</div>
                    <div className="mt-2">
                      <RiskStatusDropdown riskId={risk.id} currentStatus={risk.status ?? "open"} />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Mitigação e resposta (usando action plans como “planos vinculados”) */}
            <section className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-slate-900 dark:text-white">Planos de ação</h2>
                </div>
                <div className="flex items-center gap-3">
                  <AddActionPlanFromRiskModal riskId={risk.id} />
                  <Link
                    href={`/action-plans?risk=${risk.id}`}
                    className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Ver planos
                  </Link>
                </div>
              </div>

              <div className="p-6">
                {actionPlans.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Nenhum plano vinculado a este risco.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {actionPlans.slice(0, 3).map((ap: RiskActionPlanRow) => (
                      <Link
                        key={ap.id}
                        href={`/action-plans/${ap.id}`}
                        className="flex items-start gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-primary/40 hover:bg-primary/5 transition-colors block"
                      >
                        <div className="w-10 h-10 rounded bg-slate-50 dark:bg-slate-900/40 flex items-center justify-center text-slate-400 shrink-0">
                          <ClipboardList className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {ap.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Status: {ap.status} • Priority: {ap.priority} • Due: {ap.due_date ?? "—"} • Owner:{" "}
                            {ap.owner_name ?? "—"}
                          </div>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                          {ap.created_at}
                        </div>
                      </Link>
                    ))}

                    {actionPlans.length > 3 ? (
                      <div className="pt-2">
                        <Link href={`/action-plans?risk=${risk.id}`} className="text-sm text-primary hover:underline">
                          Ver todos ({actionPlans.length})
                        </Link>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

            {/* Atualizações do Risco */}
            <section className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-slate-900 dark:text-white">Atualizações do Risco</h2>
              </div>

              <div className="p-6 space-y-6">
                <form action={onAddUpdate} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Nova atualização
                    </label>
                    <textarea
                      name="content"
                      rows={4}
                      placeholder="Descreva as atualizações a respeito deste risco..."
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                  >
                    Adicionar atualização
                  </button>
                </form>

                {updates.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Nenhuma atualização registrada ainda.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Atualizações anteriores
                    </div>
                    {updates.map((u) => (
                      <div
                        key={u.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/30 dark:bg-slate-900/30"
                      >
                        <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{u.content}</p>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {new Date(u.created_at).toLocaleString("pt-BR")}
                          {u.author_name ? ` • por ${u.author_name}` : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Histórico de alterações */}
            <section className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-slate-900 dark:text-white">Histórico</h2>
              </div>

              <div className="p-6">
                <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-700">
                  {history.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Nenhum evento registrado ainda. As alterações feitas via Editar Risco e reavaliações aparecerão aqui.
                    </div>
                  ) : (
                    history.map((h) => (
                      <div key={h.id} className="relative pl-8">
                        <div
                          className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-primary/80 flex items-center justify-center ring-4 ring-white dark:ring-slate-900"
                          title={h.action}
                        >
                          <History className="w-3.5 h-3.5 text-white" />
                        </div>

                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{h.summary}</span>

                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {h.actor ? (
                                <>por <strong>{h.actor}</strong></>
                              ) : (
                                <>Sistema</>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className="text-xs text-slate-400">
                              {new Date(h.created_at).toLocaleString("pt-BR")}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* Se for FULL: reavaliações + timeline */}
            {risk.source === "full" ? (
              <>
                <section className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center gap-2">
                    <Bolt className="w-5 h-5 text-primary" />
                    <h2 className="font-bold text-slate-900 dark:text-white">Reavaliar risco</h2>
                  </div>

                  <div className="p-6">
                    <form action={onAddAssessment} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-2">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Impacto</div>
                        <select
                          name="impact"
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                          defaultValue={impact}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Probabilidade</div>
                        <select
                          name="likelihood"
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                          defaultValue={likelihood}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-7">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Notas</div>
                        <input
                          name="notes"
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                          placeholder="Ex: evidência de mitigação, mudança de escopo, novo controle implementado..."
                        />
                      </div>

                      <div className="md:col-span-1 flex md:justify-end">
                        <button className="w-full md:w-auto px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          Salvar
                        </button>
                      </div>
                    </form>

                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                      Regra: se o risco virar <b>high</b> ou <b>critical</b>, cria plano automaticamente. Se baixar depois,
                      o plano <b>não</b> é fechado automaticamente.
                    </div>
                  </div>
                </section>

                <section className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                    <h2 className="font-bold text-slate-900 dark:text-white">Timeline de reavaliações</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Últimos assessments (histórico auditável).
                    </p>
                  </div>

                  {assessments.length === 0 ? (
                    <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                      Nenhuma reavaliação registrada ainda.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {assessments.map((a: RiskAssessmentRow) => (
                        <div key={a.id} className="p-6">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-md border text-xs ${pillClass(
                                a.classification
                              )}`}
                            >
                              {a.classification}
                            </span>
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                              Score: <b>{a.score}</b> (I={a.impact}, P={a.likelihood})
                            </span>
                          </div>

                          <div className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                            {a.notes ? a.notes : <span className="text-slate-500 dark:text-slate-400">Sem notas.</span>}
                          </div>

                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {a.assessed_at} • por {a.assessed_by_name ?? "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : null}
          </div>

          {/* DIREITA */}
          <div className="space-y-6">
            {/* Score de risco + mini-heatmap */}
            <section className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-slate-900 dark:text-white">Score de Risco</h3>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${pillClass(scoreClass)}`}>
                  {scoreClass}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  <span>Impacto (1→5)</span>
                  <span>Prob. (5→1)</span>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 25 }).map((_, idx) => {
                    const x = (idx % 5) + 1 // impact (col) 1–5
                    const row = Math.floor(idx / 5)
                    const lik = 5 - row // probabilidade: 5 no topo, 1 embaixo
                    const cellScore = x * lik
                    const isSelected = x === impact && lik === likelihood

                    return (
                      <div
                        key={idx}
                        className={[
                          "relative aspect-square rounded-md border",
                          "border-slate-200 dark:border-slate-700",
                          heatCellBg(cellScore),
                          "flex items-center justify-center",
                        ].join(" ")}
                        title={`Impacto ${x} • Probabilidade ${lik}`}
                      >
                        {isSelected ? (
                          <span className="w-4 h-4 rounded-full bg-primary shadow-lg ring-4 ring-primary/40 dark:ring-primary/30 animate-pulse border-2 border-white dark:border-slate-900" />
                        ) : null}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Impacto</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {impact}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Probabilidade</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {likelihood}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Score</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {score}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Regra atual: score = impacto × probabilidade.
                  </div>
                </div>
              </div>
            </section>

            {/* Propriedades */}
            <section className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">Propriedades</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Fonte</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {risk.risk_source ?? "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Natureza</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {risk.natureza ?? "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Status</span>
                  <RiskStatusDropdown riskId={risk.id} currentStatus={risk.status ?? "open"} />
                </div>

                {risk.source === "full" ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Owner</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {risk.owner_name ?? "—"}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Código</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white font-mono">
                    {risk.risk_code ?? risk.domain ?? "—"}
                  </span>
                </div>
              </div>
            </section>

            {/* Ação rápida: planos vinculados (contador) */}
            <section className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Planos vinculados ({actionPlans.length})
                </h3>
                <Link href={`/action-plans?risk=${risk.id}`} className="text-primary hover:underline text-sm">
                  Abrir
                </Link>
              </div>

              <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                {actionPlans.length === 0
                  ? "Nenhum plano vinculado ainda."
                  : "Existem planos de ação associados a este risco para mitigação e acompanhamento."}
              </div>
            </section>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}