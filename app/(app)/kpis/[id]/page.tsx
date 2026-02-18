// app/(app)/kpis/[id]/page.tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import PageContainer from "../../PageContainer"
import PageHeader from "../../PageHeader"
import { fetchKpiExecutionPage } from "./actions"
import KpiExecutionClient from "./KpiExecutionClient"
import { ArrowLeft } from "lucide-react"

function pickFirst(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

function currentYYYYMM() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === "year")?.value ?? ""
  const m = parts.find((p) => p.type === "month")?.value ?? ""
  return `${y}-${m}`
}

export default async function KpiDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = (await searchParams) ?? {}

  const mes_ref = pickFirst(sp.mes_ref) ?? currentYYYYMM()

  let data: Awaited<ReturnType<typeof fetchKpiExecutionPage>> | null = null
  try {
    data = await fetchKpiExecutionPage(id, mes_ref)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes("não existe") || msg.toLowerCase().includes("tenant")) return notFound()
    throw err
  }

  const { kpi, execution, history, mes_ref_used } = data

  return (
    <PageContainer variant="default">
      <div className="space-y-6">
        <PageHeader
          title="Execução de KPI"
          description={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500 font-mono">{kpi.kpi_code}</span>
              <span className="text-sm text-slate-600">•</span>
              <span className="text-sm text-slate-700 font-medium">{kpi.kpi_name}</span>
            </div>
          }
          right={
            <Link
              href={`/controles/${kpi.control_id}?mes_ref=${encodeURIComponent(mes_ref_used)}`}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border bg-white hover:bg-slate-50"
              title="Voltar para o controle"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Link>
          }
        />

        <KpiExecutionClient kpi={kpi} mes_ref_used={mes_ref_used} execution={execution} history={history} />
      </div>
    </PageContainer>
  )
}
