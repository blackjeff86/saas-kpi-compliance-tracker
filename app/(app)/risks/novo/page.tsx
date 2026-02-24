// app/(app)/risks/novo/page.tsx
import Link from "next/link"
import PageContainer from "../../PageContainer"
import PageHeader from "../../PageHeader"
import NewRiskClient from "./NewRiskClient"
import { DEFAULT_SOURCES, DEFAULT_NATUREZAS } from "../constants"
import { ChevronLeft } from "lucide-react"

export default function NovoRiscoPage() {
  return (
    <PageContainer variant="default">
      <div className="space-y-6">
        <PageHeader
          title="Novo Risco"
          description="Cadastre um novo risco no catálogo para vinculação a controles."
          right={
            <Link
              href="/risks"
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Link>
          }
        />

        <NewRiskClient sources={DEFAULT_SOURCES} naturezas={DEFAULT_NATUREZAS} />
      </div>
    </PageContainer>
  )
}
