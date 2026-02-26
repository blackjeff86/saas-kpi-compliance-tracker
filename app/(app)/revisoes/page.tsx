// app/(app)/revisoes/page.tsx
import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import { fetchGrcQueue } from "./actions"
import GrcQueueClient from "./GrcQueueClient"

export default async function RevisoesPage() {
  const rows = await fetchGrcQueue()

  return (
    <PageContainer variant="default">
      <div className="space-y-4">
        <PageHeader
          title="Revisões GRC"
          description="Fila de execuções pendentes de revisão (submitted / under_review / needs_changes)."
        />

        <GrcQueueClient initialRows={rows} />
      </div>
    </PageContainer>
  )
}