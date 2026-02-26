// app/(app)/auditorias/[id]/acompanhamento/AuditCampaignFollowUpClient.tsx
"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Papa from "papaparse"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { addAuditCampaignRequestItems } from "./actions"
import { AlertTriangle, BarChart3, Gauge, Landmark, Monitor, Plus, Scale, Search, Upload, Users, X } from "lucide-react"

type CampaignStatus = "draft" | "active" | "closed"
type PhaseKey = "evidence" | "review_text" | "final_approval" | "other"

type FollowUpCampaign = {
  id: string
  name: string
  status: CampaignStatus
  due_date: string | null
}

type DeptProgress = {
  dept: string
  label: string
  icon: string
  pct: number
}

type ControlItem = {
  control_id: string
  control_code: string
  control_name: string
  owner_name: string | null
  owner_avatar_url: string | null
  phase: PhaseKey
  deadline: string | null
}

type RequestItem = {
  id: string
  title: string
  instructions: string | null
  item_type: string
  control_id: string | null
  control_code: string | null
  control_name: string | null
  requester_team_id: string | null
  requester_team_name: string | null
  sampling_info: string | null
  delivery_deadline: string | null
  position: number
}

export type FollowUpPayload = {
  campaign: FollowUpCampaign
  kpis: {
    progress_pct: number
    days_left: number | null
    pending_controls_total: number
    pending_evidences_total: number
    pending_evidences_new_today: number
    pending_by_dept: Array<{ dept: string; count: number }>
  }
  dept_progress: DeptProgress[]
  controls: ControlItem[]
  requester_teams: Array<{ id: string; name: string }>
  request_items: RequestItem[]
}

function clsx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ")
}

function statusPill(status: CampaignStatus) {
  if (status === "active") return "bg-emerald-100 text-emerald-800 border-emerald-200"
  if (status === "closed") return "bg-slate-100 text-slate-700 border-slate-200"
  return "bg-amber-100 text-amber-800 border-amber-200"
}

function statusLabel(status: CampaignStatus) {
  if (status === "active") return "Em Execução"
  if (status === "closed") return "Encerrada"
  return "Rascunho"
}

function phasePill(phase: PhaseKey) {
  if (phase === "evidence") return "bg-blue-100 text-blue-700"
  if (phase === "review_text") return "bg-purple-100 text-purple-700"
  if (phase === "final_approval") return "bg-emerald-100 text-emerald-700"
  return "bg-slate-100 text-slate-600"
}

function phaseLabel(phase: PhaseKey) {
  if (phase === "evidence") return "Coleta de Evidência"
  if (phase === "review_text") return "Revisão de Texto"
  if (phase === "final_approval") return "Aprovação Final"
  return "Em andamento"
}

function fmtDateBR(iso: string | null) {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function itemTypeLabel(t: string | null) {
  const map: Record<string, string> = {
    pdf: "PDF/Documento",
    screenshot: "Screenshot",
    link: "Link",
    sheet: "Planilha",
    any: "Qualquer",
  }
  return map[t || ""] ?? t ?? "—"
}

function DeptIcon({ dept }: { dept: string }) {
  const k = (dept || "").toLowerCase()
  if (k.includes("ti")) return <Monitor className="h-4 w-4 text-slate-600" />
  if (k.includes("rh")) return <Users className="h-4 w-4 text-slate-600" />
  if (k.includes("fin")) return <Landmark className="h-4 w-4 text-slate-600" />
  if (k.includes("jur")) return <Scale className="h-4 w-4 text-slate-600" />
  return <BarChart3 className="h-4 w-4 text-slate-600" />
}

type Props = {
  initialData: FollowUpPayload
}

export default function AuditCampaignFollowUpClient({ initialData }: Props) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [phase, setPhase] = useState<"all" | PhaseKey>("all")
  const [tableVisible, setTableVisible] = useState(false)
  const [requestListVisible, setRequestListVisible] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [newRequestOpen, setNewRequestOpen] = useState(false)
  const [savingRequest, setSavingRequest] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [uploadingCsv, setUploadingCsv] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [newRequest, setNewRequest] = useState({
    title: "",
    instructions: "",
    kind: "any" as "document" | "screenshot" | "link" | "spreadsheet" | "any",
    controlId: "",
    requesterTeamId: "",
    samplingInfo: "",
    deliveryDeadline: "",
  })

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    return initialData.controls.filter((r) => {
      const matchesText =
        !query ||
        `${r.control_code} ${r.control_name} ${r.owner_name ?? ""}`
          .toLowerCase()
          .includes(query)
      const matchesPhase = phase === "all" || r.phase === phase
      return matchesText && matchesPhase
    })
  }, [initialData.controls, q, phase])

  const maxBar = useMemo(() => {
    const arr = initialData.kpis.pending_by_dept.map((x) => x.count)
    return Math.max(1, ...arr)
  }, [initialData.kpis.pending_by_dept])

  const controlsByCode = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of initialData.controls) m.set(String(c.control_code || "").trim().toLowerCase(), c.control_id)
    return m
  }, [initialData.controls])

  const requesterTeamsByName = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of initialData.requester_teams) m.set(String(t.name || "").trim().toLowerCase(), t.id)
    return m
  }, [initialData.requester_teams])

  async function submitNewRequest() {
    const title = newRequest.title.trim()
    if (!title) {
      setRequestError("Informe o título da solicitação.")
      return
    }
    try {
      setSavingRequest(true)
      setRequestError(null)
      await addAuditCampaignRequestItems({
        campaignId: initialData.campaign.id,
        items: [
          {
            title,
            instructions: newRequest.instructions.trim() || null,
            kind: newRequest.kind,
            controlId: newRequest.controlId || null,
            requesterTeamId: newRequest.requesterTeamId || null,
            samplingInfo: newRequest.samplingInfo.trim() || null,
            deliveryDeadline: newRequest.deliveryDeadline || null,
          },
        ],
      })
      setNewRequestOpen(false)
      setNewRequest({
        title: "",
        instructions: "",
        kind: "any",
        controlId: "",
        requesterTeamId: "",
        samplingInfo: "",
        deliveryDeadline: "",
      })
      router.refresh()
    } catch (e: any) {
      setRequestError(e?.message ?? "Falha ao criar solicitação.")
    } finally {
      setSavingRequest(false)
    }
  }

  function normalizeKind(v: string): "document" | "screenshot" | "link" | "spreadsheet" | "any" {
    const s = String(v || "").trim().toLowerCase()
    if (s === "document" || s === "pdf") return "document"
    if (s === "screenshot") return "screenshot"
    if (s === "link") return "link"
    if (s === "spreadsheet" || s === "sheet" || s === "planilha" || s === "csv") return "spreadsheet"
    return "any"
  }

  function getCsvVal(row: Record<string, unknown>, keys: string[]) {
    for (const k of keys) {
      const v = row[k]
      if (v == null) continue
      const s = String(v).trim()
      if (s) return s
    }
    return ""
  }

  function mapRequesterTeam(row: Record<string, unknown>) {
    const teamIdRaw = getCsvVal(row, ["requester_team_id", "responsible_team_id", "team_id"])
    if (teamIdRaw) return teamIdRaw

    const teamNameRaw = getCsvVal(row, ["requester_team_name", "responsible_team_name", "team_name", "time_responsavel"])
    if (!teamNameRaw) return null
    return requesterTeamsByName.get(teamNameRaw.toLowerCase()) || null
  }

  function onCsvFileSelected(file: File | null) {
    if (!file) return
    setUploadError(null)
    setUploadingCsv(true)

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        try {
          const items: Array<{
            title: string
            instructions?: string | null
            kind: "document" | "screenshot" | "link" | "spreadsheet" | "any"
            controlId?: string | null
            requesterTeamId?: string | null
            samplingInfo?: string | null
            deliveryDeadline?: string | null
          }> = []
          const errors: string[] = []

          for (let i = 0; i < (res.data || []).length; i++) {
            const row = (res.data[i] || {}) as Record<string, unknown>
            const title = getCsvVal(row, ["title", "titulo"])
            if (!title) continue

            const controlIdRaw = getCsvVal(row, ["control_id", "controle_id"])
            const controlCodeRaw = getCsvVal(row, ["control_code", "controle_codigo", "control"])
            const controlIdFromCode = controlCodeRaw ? controlsByCode.get(controlCodeRaw.toLowerCase()) || null : null
            const controlId = controlIdRaw || controlIdFromCode || null
            const requesterTeamId = mapRequesterTeam(row)

            if (controlCodeRaw && !controlIdFromCode && !controlIdRaw) {
              errors.push(`Linha ${i + 2}: controle "${controlCodeRaw}" não encontrado no escopo da campanha.`)
              continue
            }
            const requesterTeamNameRaw = getCsvVal(row, ["requester_team_name", "responsible_team_name", "team_name", "time_responsavel"])
            if (
              (requesterTeamNameRaw || getCsvVal(row, ["requester_team_id", "responsible_team_id", "team_id"])) &&
              !requesterTeamId
            ) {
              errors.push(`Linha ${i + 2}: time responsável inválido.`)
              continue
            }

            items.push({
              title,
              instructions: getCsvVal(row, ["instructions", "descricao", "description"]) || null,
              kind: normalizeKind(getCsvVal(row, ["kind", "tipo"])),
              controlId,
              requesterTeamId,
              samplingInfo: getCsvVal(row, ["sampling_info", "amostragem"]) || null,
              deliveryDeadline: getCsvVal(row, ["delivery_deadline", "prazo"]) || null,
            })
          }

          if (errors.length > 0) {
            setUploadError(errors.slice(0, 3).join(" "))
            return
          }
          if (items.length === 0) {
            setUploadError("Nenhuma solicitação válida encontrada no CSV.")
            return
          }

          await addAuditCampaignRequestItems({
            campaignId: initialData.campaign.id,
            items,
          })
          router.refresh()
        } catch (e: any) {
          setUploadError(e?.message ?? "Falha ao importar CSV.")
        } finally {
          setUploadingCsv(false)
        }
      },
      error: (err) => {
        setUploadingCsv(false)
        setUploadError(err?.message || "Falha ao ler CSV.")
      },
    })
  }

  return (
    <div className="space-y-8">
      {/* Top - busca e filtros */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm w-full sm:w-72 focus:ring-2 focus:ring-primary/20"
              placeholder="Buscar controles..."
            />
          </div>

          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value as any)}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            <option value="all">Fase: Todas</option>
            <option value="evidence">Coleta de Evidência</option>
            <option value="review_text">Revisão de Texto</option>
            <option value="final_approval">Aprovação Final</option>
          </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="flex justify-between w-full mb-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Progresso da Campanha
            </h3>
            <Gauge className="h-4 w-4 text-primary" />
          </div>

          <Donut pct={initialData.kpis.progress_pct} />

          <p className="mt-4 text-xs text-slate-500 font-medium italic">
            {typeof initialData.kpis.days_left === "number"
              ? `Faltam ${initialData.kpis.days_left} dias para o prazo final`
              : "Prazo não definido"}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex justify-between w-full mb-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Controles Pendentes
            </h3>
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>

          <div className="flex items-end justify-between h-24 gap-4 px-2">
            {initialData.kpis.pending_by_dept.map((x) => {
              const h = Math.round((x.count / maxBar) * 100)
              return (
                <div
                  key={x.dept}
                  className="flex-1 bg-primary/10 rounded-t-lg relative"
                  style={{ height: `${Math.max(8, h)}%` }}
                  title={`${x.dept}: ${x.count}`}
                >
                  <div className="absolute inset-0 bg-primary rounded-t-lg" />
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 uppercase">
                    {x.dept}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="mt-8 flex justify-between items-center text-xs">
            <span className="text-slate-500">Total acumulado</span>
            <span className="font-bold text-slate-900">
              {initialData.kpis.pending_controls_total} Controles
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex justify-between w-full mb-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Evidências Pendentes
            </h3>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>

          <div className="flex flex-col items-center py-2">
            <span className="text-6xl font-black text-slate-900">
              {initialData.kpis.pending_evidences_total}
            </span>
            <p className="text-sm text-amber-600 font-medium mt-2 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
              Requer atenção imediata
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              +{initialData.kpis.pending_evidences_new_today} novas hoje
            </span>
            <button type="button" className="text-xs font-bold text-primary hover:underline">
              Ver todas
            </button>
          </div>
        </div>
      </div>

      {/* dept progress */}
      <div>
        <h3 className="text-base font-bold text-slate-900 mb-4">Status por Departamento</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {initialData.dept_progress.map((d) => {
            const ok = d.pct >= 70
            const warn = d.pct < 40
            return (
              <div
                key={d.dept}
                className="bg-white p-4 rounded-xl border border-slate-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="size-8 rounded bg-slate-100 flex items-center justify-center">
                    <DeptIcon dept={d.dept} />
                  </div>
                  <span className="font-semibold text-sm">{d.label}</span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                  <div
                    className={clsx(
                      "h-2 rounded-full",
                      ok ? "bg-emerald-500" : warn ? "bg-rose-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.max(0, Math.min(100, d.pct))}%` }}
                  />
                </div>

                <div className="flex justify-between items-center mt-2">
                  <span
                    className={clsx(
                      "text-xs font-bold",
                      ok ? "text-emerald-600" : warn ? "text-rose-600" : "text-primary"
                    )}
                  >
                    {d.pct}% Completo
                  </span>
                  <button
                    type="button"
                    className="text-[10px] font-bold text-primary hover:underline uppercase"
                  >
                    Ver detalhes
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            Lista de Controles Ativos{" "}
            <span className="text-slate-500 font-normal">({rows.length})</span>
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTableVisible(!tableVisible)}
              className={clsx(
                "px-3 py-1.5 text-xs font-semibold rounded transition-colors",
                tableVisible ? "bg-slate-100 hover:bg-slate-200" : "bg-primary/20 text-primary hover:bg-primary/30"
              )}
            >
              {tableVisible ? "Esconder" : "Visualizar"} tabela
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 rounded hover:bg-slate-200 transition-colors"
            >
              Filtros
            </button>
            <Button size="sm">Exportar</Button>
          </div>
        </div>

        {!tableVisible ? (
          <div className="px-6 py-6 text-center">
            <p className="text-sm text-slate-500">Tabela recolhida. Clique em &quot;Visualizar tabela&quot; para exibir os controles.</p>
          </div>
        ) : (
          <>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F2F6FF] border-b border-slate-200 dark:border-slate-800">
                <th className="ui-table-th px-4 py-3">
                  Nome do Controle
                </th>
                <th className="ui-table-th px-4 py-3">
                  Owner
                </th>
                <th className="ui-table-th px-4 py-3">
                  Fase Atual
                </th>
                <th className="ui-table-th px-4 py-3">
                  Deadline
                </th>
                <th className="ui-table-th px-4 py-3">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="ui-table-tbody divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-sm text-slate-500" colSpan={5}>
                    Nenhum controle encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.control_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900">{r.control_name}</span>
                        <span className="text-[10px] text-slate-500">ID: {r.control_code}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-full bg-slate-200 overflow-hidden">
                          {r.owner_avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              alt="Owner"
                              className="w-full h-full object-cover"
                              src={r.owner_avatar_url}
                            />
                          ) : null}
                        </div>
                        <span className="text-sm text-slate-600 font-medium">
                          {r.owner_name ?? "—"}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={clsx(
                          "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          phasePill(r.phase)
                        )}
                      >
                        {phaseLabel(r.phase)}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{fmtDateBR(r.deadline)}</span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/controles/${r.control_id}`}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
          Dica: use a busca para filtrar por controle, nome ou owner.
        </div>
          </>
        )}
      </div>

      {/* Lista de Solicitações (Request List) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            Lista de Solicitações{" "}
            <span className="text-slate-500 font-normal">({initialData.request_items.length})</span>
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setRequestError(null)
                setNewRequestOpen(true)
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded hover:bg-primary/90 transition-colors"
              title="Nova solicitação"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova solicitação
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 rounded hover:bg-slate-200 transition-colors disabled:opacity-60"
              title="Importar solicitações via CSV"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadingCsv ? "Importando..." : "Importar CSV"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                onCsvFileSelected(f)
                e.currentTarget.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => setRequestListVisible(!requestListVisible)}
              className={clsx(
                "px-3 py-1.5 text-xs font-semibold rounded transition-colors",
                requestListVisible ? "bg-slate-100 hover:bg-slate-200" : "bg-primary/20 text-primary hover:bg-primary/30"
              )}
            >
              {requestListVisible ? "Esconder" : "Visualizar"} tabela
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 rounded hover:bg-slate-200 transition-colors"
            >
              Filtros
            </button>
            <Button size="sm">Exportar</Button>
          </div>
        </div>
        {uploadError ? (
          <div className="px-6 py-2 text-xs text-red-600 border-b border-red-100 bg-red-50">{uploadError}</div>
        ) : null}

        {!requestListVisible ? (
          <div className="px-6 py-6 text-center">
            <p className="text-sm text-slate-500">
              Tabela recolhida. Clique em &quot;Visualizar tabela&quot; para exibir as solicitações.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F2F6FF] border-b border-slate-200 dark:border-slate-800">
                    <th className="ui-table-th px-4 py-3">
                      Título
                    </th>
                    <th className="ui-table-th px-4 py-3">
                      Controle
                    </th>
                    <th className="ui-table-th px-4 py-3">
                      Tipo
                    </th>
                    <th className="ui-table-th px-4 py-3">
                      Time Solicitante
                    </th>
                    <th className="ui-table-th px-4 py-3">
                      Prazo
                    </th>
                  </tr>
                </thead>
                <tbody className="ui-table-tbody divide-y divide-slate-100 dark:divide-slate-800">
                  {initialData.request_items.length === 0 ? (
                    <tr>
                      <td className="px-6 py-8 text-sm text-slate-500" colSpan={5}>
                        Nenhuma solicitação cadastrada nesta campanha.
                      </td>
                    </tr>
                  ) : (
                    initialData.request_items.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900">{r.title}</span>
                            {r.instructions && (
                              <span className="text-[11px] text-slate-500 line-clamp-1">{r.instructions}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {r.control_code && r.control_name
                            ? `${r.control_code} – ${r.control_name}`
                            : "—"}
                        </td>
                        <td className="px-6 py-4 text-xs">{itemTypeLabel(r.item_type)}</td>
                        <td className="px-6 py-4 text-sm">{r.requester_team_name || "—"}</td>
                        <td className="px-6 py-4 text-sm">{fmtDateBR(r.delivery_deadline)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
              Itens de evidência solicitados nesta campanha.
            </div>
          </>
        )}
      </div>

      {newRequestOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h4 className="text-sm font-bold text-slate-900">Nova Solicitação de Evidência</h4>
              <button
                type="button"
                onClick={() => setNewRequestOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Título da Evidência
                  </label>
                  <input
                    value={newRequest.title}
                    onChange={(e) => setNewRequest((p) => ({ ...p, title: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Ex: Logs de acesso ao sistema"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Controle
                  </label>
                  <select
                    value={newRequest.controlId}
                    onChange={(e) => setNewRequest((p) => ({ ...p, controlId: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Selecione o controle</option>
                    {initialData.controls.map((c) => (
                      <option key={c.control_id} value={c.control_id}>
                        {c.control_code} - {c.control_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Tipo
                  </label>
                  <select
                    value={newRequest.kind}
                    onChange={(e) => setNewRequest((p) => ({ ...p, kind: e.target.value as any }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="document">PDF / Documento</option>
                    <option value="screenshot">Screenshot</option>
                    <option value="link">Link Externo</option>
                    <option value="spreadsheet">Planilha (XLSX/CSV)</option>
                    <option value="any">Qualquer Formato</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Time Responsável pela Solicitação
                  </label>
                  <select
                    value={newRequest.requesterTeamId}
                    onChange={(e) => setNewRequest((p) => ({ ...p, requesterTeamId: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Selecione o time</option>
                    {initialData.requester_teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Descrição / Instruções
                </label>
                <input
                  value={newRequest.instructions}
                  onChange={(e) => setNewRequest((p) => ({ ...p, instructions: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="Instruções para o proprietário do controle..."
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Informações de Amostragem
                  </label>
                  <Textarea
                    value={newRequest.samplingInfo}
                    onChange={(e) => setNewRequest((p) => ({ ...p, samplingInfo: e.target.value }))}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-white text-sm"
                    placeholder="Metodologia ou link da planilha..."
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Prazo de Entrega
                  </label>
                  <input
                    type="date"
                    value={newRequest.deliveryDeadline}
                    onChange={(e) => setNewRequest((p) => ({ ...p, deliveryDeadline: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {requestError ? <div className="text-sm text-red-600">{requestError}</div> : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <Button variant="outline" onClick={() => setNewRequestOpen(false)} disabled={savingRequest}>
                Cancelar
              </Button>
              <Button onClick={submitNewRequest} disabled={savingRequest}>
                {savingRequest ? "Salvando..." : "Criar solicitação"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Donut({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)))
  const dash = 100
  const offset = dash - clamped

  return (
    <div className="relative size-32 flex items-center justify-center">
      <svg className="size-full -rotate-90" viewBox="0 0 36 36">
        <circle className="stroke-slate-100" cx="18" cy="18" r="16" fill="none" strokeWidth="3" />
        <circle
          className="stroke-primary"
          cx="18"
          cy="18"
          r="16"
          fill="none"
          strokeWidth="3"
          strokeDasharray={`${dash}`}
          strokeDashoffset={`${offset}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-2xl font-bold text-slate-900">{clamped}%</span>
    </div>
  )
}
