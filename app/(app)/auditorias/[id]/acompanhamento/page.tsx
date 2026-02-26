// app/(app)/auditorias/[id]/acompanhamento/page.tsx
import Link from "next/link"
import PageContainer from "../../../PageContainer"
import PageHeader from "../../../PageHeader"
import { fetchAuditCampaignFollowUp } from "./actions"
import AuditCampaignFollowUpClient from "./AuditCampaignFollowUpClient"

function statusBadgeClass(status: string) {
  if (status === "active") return "bg-emerald-100 text-emerald-800 border-emerald-200"
  if (status === "closed") return "bg-slate-100 text-slate-700 border-slate-200"
  return "bg-amber-100 text-amber-800 border-amber-200"
}
function statusLabel(status: string) {
  if (status === "active") return "Em Execução"
  if (status === "closed") return "Encerrada"
  return "Rascunho"
}

export default async function AuditoriaAcompanhamentoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await fetchAuditCampaignFollowUp({ campaignId: id })

  return (
    <PageContainer variant="default">
      <div className="space-y-4">
        <PageHeader
          title={`Acompanhamento: ${data.campaign.name}`}
          description="Visão de progresso, pendências e lista de controles em execução."
          badge={
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass(data.campaign.status)}`}
            >
              {statusLabel(data.campaign.status)}
            </span>
          }
          right={
            <Link
              href="/auditorias"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              ← Voltar
            </Link>
          }
        />
        <AuditCampaignFollowUpClient initialData={data} />
      </div>
    </PageContainer>
  )
}