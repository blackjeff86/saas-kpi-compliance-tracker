// app/(app)/controles/novo/page.tsx
import PageContainer from "../../PageContainer"
import PageHeader from "../../PageHeader"
import NewControlClient from "./NewControlClient"
import { fetchFrameworkOptions, fetchUserOptions } from "./actions"

export default async function NewControlPage() {
  const [frameworks, users] = await Promise.all([fetchFrameworkOptions(), fetchUserOptions()])

  return (
    <PageContainer variant="default">
      <div className="space-y-6">
        <PageHeader
          title="Cadastrar novo controle"
          description="Preencha os dados do controle (campos do CSV) e, se quiser, já cadastre os KPIs relacionados."
        />

        <NewControlClient frameworks={frameworks} users={users} />
      </div>
    </PageContainer>
  )
}
