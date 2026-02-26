// app/(app)/auditorias/nova/page.tsx
import Link from "next/link"
import PageContainer from "../../PageContainer"
import PageHeader from "../../PageHeader"
import { fetchAuditCampaignCreateContext } from "@/app/(app)/auditorias/nova/actions"
import AuditCampaignCreateClient from "@/app/(app)/auditorias/nova/AuditCampaignCreateClient"

export default async function NovaAuditoriaPage() {
  const ctx = await fetchAuditCampaignCreateContext()

  return (
    <PageContainer variant="default">
      <div className="space-y-4">
        <PageHeader
          title="Criar Campanha de Revisão e Auditoria"
          description="Configure uma nova rodada de auditoria, defina o escopo e configure a coleta de evidências."
          right={
            <Link
              href="/auditorias"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              ← Voltar
            </Link>
          }
        />

        <AuditCampaignCreateClient initialContext={ctx} />
      </div>
    </PageContainer>
  )
}