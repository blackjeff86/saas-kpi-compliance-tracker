// app/(app)/controles/import/page.tsx
import Link from "next/link"
import PageContainer from "../../PageContainer"
import ImportControlsClient from "./ImportControlsClient"
import { ChevronLeft } from "lucide-react"

export default async function ImportControlsPage() {
  return (
    <PageContainer variant="default">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/controles"
                className="p-1 -ml-1 text-slate-400 hover:text-primary transition-colors rounded-full hover:bg-slate-100"
                title="Voltar para Controles"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>

              <h1 className="text-2xl font-semibold">Importação de Controles (CSV)</h1>
            </div>
            <p className="text-sm text-slate-500 ml-8">
              Carregue seus controles em massa utilizando um arquivo CSV. Você poderá validar e pré-visualizar antes de
              processar.
            </p>
          </div>
        </div>

        {/* Client UI */}
        <ImportControlsClient />
      </div>
    </PageContainer>
  )
}
