import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import { fetchGrcQueue, fetchGrcQueueFilterOptions } from "./actions"
import GrcQueueClient from "./GrcQueueClient"

type SearchParams = Record<string, string | string[] | undefined>

function pickFirst(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0]
  return v
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

export default async function RevisoesPage(props: { searchParams?: Promise<SearchParams> }) {
  const sp = props.searchParams ? await props.searchParams : {}
  const mes_ref = (pickFirst(sp.mes_ref) || "").trim() || currentYYYYMM()

  const [rows, opts] = await Promise.all([
    fetchGrcQueue({ mes_ref }),
    fetchGrcQueueFilterOptions(),
  ])

  return (
    <PageContainer variant="default">
      <div className="space-y-4">
        <PageHeader
          title="Revisões GRC"
          description="Fila de execuções pendentes de revisão (submitted / under_review / needs_changes)."
        />

        <GrcQueueClient initialRows={rows} months={opts.months} mesRef={mes_ref} />
      </div>
    </PageContainer>
  )
}