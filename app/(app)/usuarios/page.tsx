import { formatDatePtBr } from "@/lib/utils"
import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import { fetchUsers } from "./actions"

export default async function UsuariosPage() {
  const rows = await fetchUsers()

  return (
    <PageContainer variant="default">
      <div className="space-y-4">
        <PageHeader
          title="Usuários"
          right={<div className="text-sm text-slate-500">{rows.length} registro(s)</div>}
        />

        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="grid grid-cols-12 gap-1 px-4 py-3 text-[11px] font-semibold text-slate-500 border-b bg-slate-50 uppercase tracking-wide">
            <div className="col-span-4 normal-case">Nome</div>
            <div className="col-span-5 normal-case">Email</div>
            <div className="col-span-3 normal-case">Role</div>
          </div>

          {rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Nenhum usuário cadastrado.</div>
          ) : (
            rows.map((u) => (
              <div
                key={u.id}
                className="grid grid-cols-12 gap-1 px-4 py-3 text-sm border-b last:border-b-0 items-center"
              >
                <div className="col-span-4">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-slate-500">criado em {formatDatePtBr(u.created_at)}</div>
                </div>
                <div className="col-span-5 text-slate-700">{u.email}</div>
                <div className="col-span-3">
                  <span className="inline-flex px-2 py-1 rounded-md border text-xs bg-slate-50 text-slate-700 border-slate-200">
                    {u.role}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageContainer>
  )
}
