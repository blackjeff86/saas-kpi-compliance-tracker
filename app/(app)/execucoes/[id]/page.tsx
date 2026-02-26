import { formatDatePtBr } from "@/lib/utils"
import PageContainer from "../../PageContainer"
import PageHeader from "../../PageHeader"
import { fetchExecutionDetail, fetchEvidences } from "../actions-detail"
import GrcReviewActions from "./GrcReviewActions"
import ResultEditor from "./ResultEditor"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const exec = await fetchExecutionDetail(id)
  const evidences = await fetchEvidences(id)

  if (!exec) {
    return (
      <PageContainer variant="default">
        <div>Execução não encontrada.</div>
      </PageContainer>
    )
  }

  return (
    <PageContainer variant="default">
      <div className="space-y-6">
        <PageHeader
          title={`${exec.control_code} • ${exec.kpi_code}`}
          description={
            <div className="space-y-1">
              <div className="text-sm text-slate-600">{exec.control_name}</div>
              <div className="text-sm text-slate-500">
                Período: {exec.period_start} → {exec.period_end}
              </div>
            </div>
          }
        />

        {/* Resultado (EDITÁVEL + recalcula auto_status) */}
        <ResultEditor
          executionId={exec.id}
          initialNumeric={exec.result_numeric ?? null}
          initialNotes={exec.result_notes ?? null}
          initialAutoStatus={exec.auto_status ?? null}
          initialWorkflowStatus={exec.workflow_status ?? null}
        />

        {/* Revisão GRC com botões (salva no banco) */}
        <GrcReviewActions
          executionId={exec.id}
          initialDecision={exec.grc_decision}
          initialComment={exec.grc_comment}
        />

        {/* Evidências */}
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50">
            <h2 className="text-sm font-medium text-slate-900">Evidências</h2>
            <p className="text-xs text-slate-500">Arquivos e registros anexados a esta execução.</p>
          </div>

          {evidences.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Nenhuma evidência anexada.</div>
          ) : (
            <div className="divide-y">
              {evidences.map((ev: any) => (
                <div key={ev.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{ev.title}</div>
                    <div className="text-xs text-slate-500">
                      {ev.type} • {formatDatePtBr(ev.created_at)}
                    </div>
                  </div>

                  {ev.file_url ? (
                    <a className="text-sm underline shrink-0" href={ev.file_url} target="_blank" rel="noreferrer">
                      Abrir
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 shrink-0">—</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
