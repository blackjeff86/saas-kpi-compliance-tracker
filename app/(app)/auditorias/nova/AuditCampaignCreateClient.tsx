// app/(app)/auditorias/nova/AuditCampaignCreateClient.tsx
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type {
  CreateAuditCampaignInput,
  CreateAuditCampaignContext,
  ControlPickRow,
  EvidenceItemInput,
} from "./actions"
import { createAuditCampaign } from "./actions"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function clsx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ")
}

type MultiSelectFilterProps = {
  label: string
  options: Array<{ value: string; label: string }>
  selected: Set<string>
  onChange: (selected: Set<string>) => void
}

function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  const toggle = useCallback(
    (value: string) => {
      const next = new Set(selected)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      onChange(next)
    },
    [selected, onChange]
  )

  const clear = useCallback(() => onChange(new Set()), [onChange])

  const displayText =
    selected.size === 0 ? "Todos" : `${selected.size} selecionado${selected.size > 1 ? "s" : ""}`

  return (
    <div className="relative shrink-0" ref={ref}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-44 text-left text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-slate-300 transition-colors flex items-center justify-between gap-2"
        >
          <span className="truncate">{displayText}</span>
          <span className="text-slate-400">▼</span>
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 w-56 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-2">
          <button
            type="button"
            onClick={clear}
            className="w-full px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-50"
          >
            Limpar (mostrar todos)
          </button>
          <div className="border-t border-slate-100 my-1" />
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={() => toggle(opt.value)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function riskPill(level?: string | null) {
  const s = (level || "").toLowerCase()
  if (s.includes("critical")) return "bg-red-50 text-red-700 border-red-200"
  if (s.includes("high")) return "bg-amber-50 text-amber-700 border-amber-200"
  if (s.includes("med") || s.includes("moderate")) return "bg-yellow-50 text-yellow-700 border-yellow-200"
  if (s.includes("low")) return "bg-emerald-50 text-emerald-700 border-emerald-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

type Props = {
  initialContext: CreateAuditCampaignContext
}

export default function AuditCampaignCreateClient({ initialContext }: Props) {
  const router = useRouter()

  // ====== STEP 1 ======
  const [name, setName] = useState("")
  const [framework, setFramework] = useState<string>("")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")
  const [objective, setObjective] = useState("")

  // ====== STEP 2 ======
  const [areaSelected, setAreaSelected] = useState<Set<string>>(new Set())
  const [frequencySelected, setFrequencySelected] = useState<Set<string>>(new Set())
  const [qControls, setQControls] = useState("")
  const [selectedControlIds, setSelectedControlIds] = useState<Record<string, boolean>>({})

  // ====== STEP 3 (Request list) ======
  const [evidences, setEvidences] = useState<EvidenceItemInput[]>([])

  // ====== Create flow ======
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [openDone, setOpenDone] = useState(false)

  const controls = useMemo(() => {
    const query = qControls.trim().toLowerCase()
    return initialContext.controls.filter((c: ControlPickRow) => {
      const domainVal = (c.domain ?? "") === "(Sem área)" ? "__sem__" : (c.domain ?? "")
      const freqVal = (c.frequency ?? "") === "(Sem frequência)" ? "__sem__" : (c.frequency ?? "")

      const matchesArea = areaSelected.size === 0 || areaSelected.has(domainVal)
      const matchesFreq = frequencySelected.size === 0 || frequencySelected.has(freqVal)
      const matchesText =
        !query ||
        `${c.control_code} ${c.control_name} ${c.domain ?? ""} ${c.frequency ?? ""}`.toLowerCase().includes(query)

      return matchesArea && matchesFreq && matchesText
    })
  }, [initialContext.controls, qControls, areaSelected, frequencySelected])

  const selectedCount = useMemo(() => {
    let n = 0
    for (const k of Object.keys(selectedControlIds)) if (selectedControlIds[k]) n++
    return n
  }, [selectedControlIds])

  const canCreate =
    name.trim().length >= 3 &&
    !!framework &&
    !!periodStart &&
    !!periodEnd &&
    selectedCount > 0 &&
    !saving

  function toggleControl(id: string) {
    setSelectedControlIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleAllCurrentPage(checked: boolean, list: ControlPickRow[]) {
    setSelectedControlIds((prev) => {
      const next = { ...prev }
      for (const c of list) next[c.control_id] = checked
      return next
    })
  }

  function selectAllControls() {
    const next: Record<string, boolean> = {}
    for (const c of controls) next[c.control_id] = true
    setSelectedControlIds(next)
  }

  function clearAllControls() {
    setSelectedControlIds({})
  }

  const selectedControlsList = useMemo(() => {
    return initialContext.controls.filter((c) => selectedControlIds[c.control_id])
  }, [initialContext.controls, selectedControlIds])

  function addEvidence() {
    setEvidences((prev) => [
      ...prev,
      {
        title: "",
        instructions: "",
        kind: "any",
        controlId: "",
        requesterTeamId: "",
        samplingInfo: "",
        deliveryDeadline: "",
      },
    ])
  }

  function updateEvidence(idx: number, patch: Partial<EvidenceItemInput>) {
    setEvidences((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)))
  }

  function removeEvidence(idx: number) {
    setEvidences((prev) => prev.filter((_, i) => i !== idx))
  }

  async function submit() {
    try {
      setSaving(true)
      setError(null)

      const controlIds = Object.entries(selectedControlIds)
        .filter(([, v]) => v)
        .map(([k]) => k)

      const cleanedEvidences = evidences
        .map((e) => ({
          title: (e.title || "").trim(),
          instructions: (e.instructions || "").trim(),
          kind: e.kind,
          controlId: e.controlId?.trim() || null,
          requesterTeamId: e.requesterTeamId?.trim() || null,
          samplingInfo: e.samplingInfo?.trim() || null,
          deliveryDeadline: e.deliveryDeadline?.trim() || null,
        }))
        .filter((e) => e.title.length > 0)

      const payload: CreateAuditCampaignInput = {
        name: name.trim(),
        framework,
        periodStart,
        periodEnd,
        objective: objective.trim() || null,
        controlIds,
        evidences: cleanedEvidences,
      }

      const res = await createAuditCampaign(payload)

      setCreatedId(res.campaignId)
      setOpenDone(true)
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar campanha.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8 pb-10">
      {/* ===== 1. Definição ===== */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            1. Definição da Campanha
          </h2>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Nome da Campanha
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="Ex: Auditoria Anual de Segurança da Informação 2026"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Framework
              </label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              >
                <option value="">Selecione um framework...</option>
                {initialContext.frameworks.map((f: { value: string; label: string }) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Período da Auditoria
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2.5"
                  type="date"
                />
                <input
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2.5"
                  type="date"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Objetivo
              </label>
              <Textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Descreva os objetivos principais desta rodada de revisão..."
                rows={3}
                className="bg-white border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== 2. Escopo ===== */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              2. Escopo e Seleção
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Selecione os controles que farão parte da campanha.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">
              <span className="font-semibold text-slate-900">{selectedCount}</span> selecionado(s)
            </span>
            <button
              type="button"
              onClick={selectAllControls}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Selecionar todos
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={clearAllControls}
              className="text-xs font-semibold text-slate-600 hover:underline"
            >
              Limpar
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:flex-wrap">
            <MultiSelectFilter
              label="Área"
              options={initialContext.areaOptions.filter((a) => a.value !== "all")}
              selected={areaSelected}
              onChange={setAreaSelected}
            />
            <MultiSelectFilter
              label="Frequência"
              options={initialContext.frequencyOptions.filter((f) => f.value !== "all")}
              selected={frequencySelected}
              onChange={setFrequencySelected}
            />
            <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:items-center sm:ml-auto">
              <input
                value={qControls}
                onChange={(e) => setQControls(e.target.value)}
                className="w-full sm:max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Buscar controle, domínio..."
              />
              <div className="text-xs text-slate-500 shrink-0">
                {controls.length} item(ns)
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <div className="col-span-1">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  onChange={(e) => toggleAllCurrentPage(e.target.checked, controls)}
                  aria-label="Selecionar todos da página"
                />
              </div>
              <div className="col-span-4">ID / Controle</div>
              <div className="col-span-2">Domínio</div>
              <div className="col-span-2">Frequência</div>
              <div className="col-span-3">Criticidade</div>
            </div>

            <div className="divide-y divide-slate-100">
              {controls.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">Nenhum controle encontrado.</div>
              ) : (
                controls.map((c: ControlPickRow) => {
                  const checked = !!selectedControlIds[c.control_id]
                  return (
                    <div
                      key={c.control_id}
                      className="grid grid-cols-12 gap-2 px-6 py-4 text-sm items-center hover:bg-slate-50"
                    >
                      <div className="col-span-1">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={checked}
                          onChange={() => toggleControl(c.control_id)}
                          aria-label={`Selecionar ${c.control_code}`}
                        />
                      </div>

                      <div className="col-span-4">
                        <div className="font-medium text-slate-900">
                          {c.control_code}{" "}
                          <span className="text-slate-500 font-normal">• {c.control_name}</span>
                        </div>
                      </div>

                      <div className="col-span-2 text-slate-500">{c.domain ?? "—"}</div>
                      <div className="col-span-2 text-slate-500">{c.frequency ?? "—"}</div>

                      <div className="col-span-3">
                        <span
                          className={clsx(
                            "inline-flex items-center px-2 py-1 rounded-md border text-xs",
                            riskPill(c.risk_level)
                          )}
                        >
                          {c.risk_level ?? "—"}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center">
              <span className="text-xs text-slate-500">
                Dica: use os filtros de área e frequência + busca para achar rápido.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 3. Evidências ===== */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            3. Configurações de Auditoria & Evidências
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Defina a request list, amostragem, prazo e itens de evidência para os donos dos controles.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="border border-slate-200 rounded-lg bg-slate-50/30 overflow-hidden">
            <div className="p-4 space-y-4">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                Request List (Itens de Evidência)
              </span>

              <p className="text-[11px] text-slate-500">
                Cada item: título, descrição, controle associado, amostragem e prazo.
              </p>

              {evidences.length === 0 ? (
                <div className="text-sm text-slate-500">Nenhum item de evidência adicionado.</div>
              ) : (
                evidences.map((e, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-slate-200 rounded-lg bg-slate-50/30 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-500">Item #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeEvidence(idx)}
                        className="text-slate-400 hover:text-red-500 text-sm"
                        title="Remover"
                      >
                        🗑 Remover
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Título da Evidência
                        </label>
                        <input
                          value={e.title}
                          onChange={(ev) => updateEvidence(idx, { title: ev.target.value })}
                          className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2"
                          placeholder="Ex: Logs de acesso ao sistema"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Controle
                        </label>
                        <select
                          value={e.controlId || ""}
                          onChange={(ev) => updateEvidence(idx, { controlId: ev.target.value || "" })}
                          className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2"
                        >
                          <option value="">Selecione o controle</option>
                          {selectedControlsList.map((c) => (
                            <option key={c.control_id} value={c.control_id}>
                              {c.control_code} – {c.control_name}
                            </option>
                          ))}
                        </select>
                        {selectedControlsList.length === 0 && (
                          <p className="text-[10px] text-amber-600 mt-1">
                            Selecione controles na seção 2 primeiro.
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Descrição / Instruções
                      </label>
                      <input
                        value={e.instructions || ""}
                        onChange={(ev) => updateEvidence(idx, { instructions: ev.target.value })}
                        className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2"
                        placeholder="Instruções para o proprietário do controle..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Time Responsável pela Solicitação
                        </label>
                        <select
                          value={e.requesterTeamId || ""}
                          onChange={(ev) => updateEvidence(idx, { requesterTeamId: ev.target.value || "" })}
                          className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2"
                        >
                          <option value="">Selecione o time</option>
                          {initialContext.requesterTeams.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Informações de Amostragem
                        </label>
                        <Textarea
                          value={e.samplingInfo || ""}
                          onChange={(ev) => updateEvidence(idx, { samplingInfo: ev.target.value })}
                          placeholder="Metodologia ou link da planilha..."
                          rows={2}
                          className="bg-white border border-slate-200 rounded-lg w-full text-sm"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Texto ou link para planilha com critérios.
                        </p>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Prazo de Entrega
                        </label>
                        <input
                          value={e.deliveryDeadline || ""}
                          onChange={(ev) => updateEvidence(idx, { deliveryDeadline: ev.target.value })}
                          type="date"
                          className="w-full text-sm bg-white border border-slate-200 rounded-lg px-4 py-2.5"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Data limite para entrega desta evidência.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide shrink-0">
                        Tipo:
                      </label>
                      <select
                        value={e.kind}
                        onChange={(ev) => updateEvidence(idx, { kind: ev.target.value as any })}
                        className="text-xs border border-slate-200 rounded bg-white px-2 py-1.5"
                        title="Tipo"
                      >
                        <option value="document">PDF / Documento</option>
                        <option value="screenshot">Screenshot</option>
                        <option value="link">Link Externo</option>
                        <option value="spreadsheet">Planilha (XLSX/CSV)</option>
                        <option value="any">Qualquer Formato</option>
                      </select>
                    </div>
                  </div>
                ))
              )}

                <button
                  type="button"
                  onClick={addEvidence}
                  className="mt-3 flex items-center gap-2 text-primary text-xs font-bold px-3 py-1.5 border border-primary/20 bg-primary/5 rounded hover:bg-primary/10 transition-colors w-fit"
                >
                  <span className="text-sm">＋</span> Adicionar Item
                </button>
            </div>
          </div>

          {error ? (
            <div className="text-sm text-red-600 pt-2">{error}</div>
          ) : null}

          <div className="pt-4 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/auditorias")}
              disabled={saving}
            >
              Cancelar
            </Button>

            <Button onClick={submit} disabled={!canCreate}>
              {saving ? "Criando..." : "Ativar Campanha"}
            </Button>
          </div>

          <div className="text-[11px] text-slate-500">
            A campanha será criada com status <span className="font-semibold">active</span>.
            Se preferir rascunho, eu ajusto o fluxo.
          </div>
        </div>
      </section>

      {/* DONE MODAL */}
      <Dialog
        open={openDone}
        onOpenChange={(v) => {
          setOpenDone(v)
          if (!v && createdId) {
            router.push(`/auditorias/${createdId}`)
            router.refresh()
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Campanha criada</DialogTitle>
            <DialogDescription>
              Sua campanha foi criada com sucesso. Você pode abrir o detalhe ou ir direto para o acompanhamento.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setOpenDone(false)
                if (createdId) router.push(`/auditorias/${createdId}`)
              }}
            >
              Abrir detalhe
            </Button>
            <Button
              onClick={() => {
                setOpenDone(false)
                if (createdId) router.push(`/auditorias/${createdId}/acompanhamento`)
              }}
            >
              Ir para acompanhamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
