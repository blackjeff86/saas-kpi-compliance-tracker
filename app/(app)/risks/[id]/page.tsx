import Link from "next/link"
import { notFound } from "next/navigation"
import PageContainer from "../../PageContainer"
import PageHeader from "../../PageHeader"
import {
  fetchRiskById,
  type RiskAssessmentRow,
  type RiskActionPlanRow,
} from "../actions-detail"
import { addRiskAssessment } from "../actions-assessment"

function pillClass(v: string) {
  const s = (v || "").toLowerCase()
  if (s === "critical") return "bg-red-50 text-red-700 border-red-200"
  if (s === "high") return "bg-amber-50 text-amber-700 border-amber-200"
  if (s === "med") return "bg-yellow-50 text-yellow-800 border-yellow-200"
  if (s === "low") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

export default async function RiskDetailPage(props: {
  params?: { id?: string }
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const id = props.params?.id
  if (!id || id === "undefined") notFound()

  const data = await fetchRiskById(id)
  const risk = data.risk
  const assessments: RiskAssessmentRow[] = data.assessments
  const actionPlans: RiskActionPlanRow[] = data.actionPlans

  const from = props.searchParams?.from
  const fromValue = Array.isArray(from) ? from[0] : from
  const cameFromActionPlans = fromValue === "action-plans"

  const spRisk = props.searchParams?.risk
  const spRiskId = Array.isArray(spRisk) ? spRisk[0] : spRisk
  const riskIdForBackLink = spRiskId || risk.id

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

  const backLinks = (
    <div className="text-sm text-slate-500 flex flex-wrap items-center gap-2">
      {cameFromActionPlans ? (
        <>
          <Link href={`/action-plans?risk=${riskIdForBackLink}`} className="hover:underline">
            ← Voltar para planos filtrados
          </Link>
          <span className="text-slate-300">|</span>
        </>
      ) : null}

      <Link href="/risks" className="hover:underline">
        ← Voltar para riscos
      </Link>

      <span className="text-slate-300">|</span>

      <Link href={`/action-plans?risk=${risk.id}`} className="hover:underline">
        Ver planos de ação →
      </Link>

      {cameFromActionPlans ? (
        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-md border text-xs bg-slate-50 text-slate-700 border-slate-200">
          Vindo de Planos de Ação (filtro ativo)
        </span>
      ) : null}
    </div>
  )

  return (
    <PageContainer variant="default">
      <div className="space-y-6">
        <PageHeader
          title={risk.title}
          description={
            <div className="space-y-2">
              {backLinks}
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className={`inline-flex items-center px-2 py-1 rounded-md border text-xs ${pillClass(risk.classification)}`}>
                  {risk.classification}
                </span>
                <span className="text-slate-400">•</span>
                <span>Status: {risk.status}</span>
                <span className="text-slate-400">•</span>
                <span>Domínio: {risk.domain}</span>
                <span className="text-slate-400">•</span>
                <span>Owner: {risk.owner_name ?? "—"}</span>
              </div>

              {risk.description ? (
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{risk.description}</p>
              ) : null}
            </div>
          }
          right={
            <div className="text-xs text-slate-500 text-right">
              <div>Criado: {risk.created_at}</div>
              <div>Atualizado: {risk.updated_at}</div>
            </div>
          }
        />

        {/* Snapshot */}
        <div className="rounded-xl border bg-white p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <div className="text-xs text-slate-500">Impacto</div>
              <div className="text-lg font-semibold">{risk.impact}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Probabilidade</div>
              <div className="text-lg font-semibold">{risk.likelihood}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Score</div>
              <div className="text-lg font-semibold">{risk.risk_score}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs text-slate-500">Classificação atual</div>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2 py-1 rounded-md border text-sm ${pillClass(risk.classification)}`}>
                  {risk.classification}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Adicionar reavaliação */}
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50">
            <h2 className="text-sm font-medium text-slate-900">Reavaliar risco</h2>
            <p className="text-xs text-slate-500">Cria um novo assessment e atualiza a classificação atual do risco.</p>
          </div>

          <div className="p-4">
            <form action={onAddAssessment} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
              <div className="md:col-span-2">
                <div className="text-xs text-slate-500 mb-1">Impacto</div>
                <select name="impact" className="w-full rounded-lg border bg-white px-3 py-2 text-sm" defaultValue={risk.impact}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="text-xs text-slate-500 mb-1">Probabilidade</div>
                <select
                  name="likelihood"
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  defaultValue={risk.likelihood}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-7">
                <div className="text-xs text-slate-500 mb-1">Notas</div>
                <input
                  name="notes"
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  placeholder="Ex: evidência de mitigação, mudança de escopo, novo controle implementado..."
                />
              </div>

              <div className="md:col-span-1 flex md:justify-end">
                <button className="w-full md:w-auto px-3 py-2 text-sm rounded-lg border hover:bg-slate-50">
                  Salvar
                </button>
              </div>
            </form>

            <div className="text-xs text-slate-500 mt-2">
              Regra: se o risco virar <b>high</b> ou <b>critical</b>, cria plano automaticamente. Se baixar depois, o plano{" "}
              <b>não</b> é fechado automaticamente.
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50">
            <h2 className="text-sm font-medium text-slate-900">Timeline de reavaliações</h2>
            <p className="text-xs text-slate-500">Últimos assessments (histórico auditável).</p>
          </div>

          {assessments.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Nenhuma reavaliação registrada ainda.</div>
          ) : (
            <div className="divide-y">
              {assessments.map((a: RiskAssessmentRow) => (
                <div key={a.id} className="p-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md border text-xs ${pillClass(a.classification)}`}>
                        {a.classification}
                      </span>
                      <span className="text-sm text-slate-600">
                        Score: <b>{a.score}</b> (I={a.impact}, P={a.likelihood})
                      </span>
                    </div>

                    {a.notes ? (
                      <div className="text-sm text-slate-700 whitespace-pre-wrap">{a.notes}</div>
                    ) : (
                      <div className="text-sm text-slate-500">Sem notas.</div>
                    )}

                    <div className="text-xs text-slate-500">
                      {a.assessed_at} • por {a.assessed_by_name ?? "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action plans vinculados */}
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50">
            <h2 className="text-sm font-medium text-slate-900">Planos de ação vinculados</h2>
            <p className="text-xs text-slate-500">Action plans onde action_plans.risk_id = este risco.</p>
          </div>

          {actionPlans.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Nenhum plano vinculado a este risco.</div>
          ) : (
            <div className="divide-y">
              {actionPlans.map((ap: RiskActionPlanRow) => (
                <div key={ap.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{ap.title}</div>
                      <div className="text-xs text-slate-500">
                        Status: {ap.status} • Priority: {ap.priority} • Due: {ap.due_date ?? "—"} • Owner: {ap.owner_name ?? "—"}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 shrink-0">{ap.created_at}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
