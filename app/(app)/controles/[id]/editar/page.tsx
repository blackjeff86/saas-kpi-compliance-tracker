// app/(app)/controles/[id]/editar/page.tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import PageContainer from "../../../PageContainer"
import PageHeader from "../../../PageHeader"
import { ChevronLeft, Save } from "lucide-react"

import NewControlClient from "../../novo/NewControlClient"
import { fetchFrameworkOptions, fetchUserOptions } from "../../novo/actions"
import { fetchControlForEdit } from "./actions"

export default async function EditControlPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [frameworks, users, initialData] = await Promise.all([
    fetchFrameworkOptions(),
    fetchUserOptions(),
    fetchControlForEdit(id),
  ])

  if (!initialData?.control) return notFound()

  return (
    <PageContainer variant="default">
      <div className="space-y-6">
        <PageHeader
          title="Editar Controle"
          description="Edição de Controle + KPIs."
          right={
            <>
              <Link
                href={`/controles/${id}`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </Link>

              <button
                type="submit"
                form="new-control-form"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
              >
                <Save className="w-4 h-4" />
                Salvar
              </button>
            </>
          }
        />

        {/* ✅ modo edit + dados preenchidos */}
        <NewControlClient
          frameworks={frameworks}
          users={users}
          mode="edit"
          controlId={id}
          initialData={initialData}
        />
      </div>
    </PageContainer>
  )
}
