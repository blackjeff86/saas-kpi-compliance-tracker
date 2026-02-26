// app/(app)/configuracoes/page.tsx
import PageContainer from "../PageContainer"
import ConfiguracoesClient from "./ConfiguracoesClient"
import { getContext } from "../lib/context"
import { getEffectivePermissions } from "../lib/authz"

export default async function ConfiguracoesPage() {
  const ctx = await getContext()
  const perms = await getEffectivePermissions(ctx.tenantId, ctx.userId)
  const hasRbacPermission = perms.has("rbac_admin:manage")

  return (
    <PageContainer variant="default">
      <div className="space-y-4">
        <ConfiguracoesClient hasRbacPermission={hasRbacPermission} />
      </div>
    </PageContainer>
  )
}
