// app/(app)/auditorias/page.tsx
import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import { fetchAuditHub } from "./actions"
import AuditHubClient from "./AuditHubClient"

export default async function AuditoriasPage() {
  const data = await fetchAuditHub()

  return (
    <PageContainer variant="default">
      <div className="space-y-4">
        <PageHeader
          title="Gestão de Auditorias"
          description="Acompanhe campanhas, progresso e pendências de evidências."
          right={
            <a
              href="/auditorias/nova"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold text-sm rounded-lg hover:bg-primary/90 transition shadow-sm"
            >
              <span className="text-sm">＋</span>
              Criar Campanha
            </a>
          }
        />

        <AuditHubClient initialData={data} />
      </div>
    </PageContainer>
  )
}