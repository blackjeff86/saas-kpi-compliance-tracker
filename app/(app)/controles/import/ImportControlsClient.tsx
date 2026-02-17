"use client"

import React, { useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import Papa from "papaparse"
import {
  Download,
  UploadCloud,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  FileSpreadsheet,
  Play,
} from "lucide-react"

// ✅ ajuste o caminho se necessário
import { importarControlesCompleto } from "../actions"

type ImportRow = {
  framework: string
  control_code: string
  control_name: string
  control_description?: string
  control_status?: string
  control_frequency?: string
  control_type?: string
  control_owner_email?: string
  focal_point_email?: string

  risk_code?: string
  risk_name?: string
  risk_description?: string
  risk_classification?: string

  kpi_code?: string
  kpi_name?: string
  kpi_description?: string
  kpi_target?: string | number
}

type RowValidation = {
  ok: boolean
  issues: string[]
}

const REQUIRED_KEYS: (keyof ImportRow)[] = ["framework", "control_code", "control_name"]

function norm(v: any) {
  return String(v ?? "").trim()
}

function stripBom(s: string) {
  return s?.replace(/^\uFEFF/, "") ?? s
}

/**
 * Retorna SOMENTE keys válidas do template.
 * Se não for reconhecida, retorna null.
 */
function normalizeKey(k: string): keyof ImportRow | null {
  const s = stripBom(norm(k)).toLowerCase()

  const map: Record<string, keyof ImportRow> = {
    // framework
    framework: "framework",
    norma: "framework",

    // control
    control_code: "control_code",
    code: "control_code",
    codigo: "control_code",
    "código": "control_code",

    control_name: "control_name",
    nome: "control_name",
    "nome do controle": "control_name",

    control_description: "control_description",
    descricao: "control_description",
    "descrição": "control_description",
    description: "control_description",

    control_status: "control_status",
    status: "control_status",

    control_frequency: "control_frequency",
    frequencia: "control_frequency",
    "frequência": "control_frequency",
    frequency: "control_frequency",

    control_type: "control_type",
    tipo: "control_type",

    control_owner_email: "control_owner_email",
    owner: "control_owner_email",
    owner_email: "control_owner_email",

    focal_point_email: "focal_point_email",
    focal: "focal_point_email",
    focal_email: "focal_point_email",

    // risk
    risk_code: "risk_code",
    risk_id: "risk_code",
    "id do risco": "risk_code",

    risk_name: "risk_name",
    "nome do risco": "risk_name",

    risk_description: "risk_description",
    "descrição do risco": "risk_description",

    risk_classification: "risk_classification",
    classificacao: "risk_classification",
    "classificação": "risk_classification",
    "classificacao do risco": "risk_classification",

    // kpi
    kpi_code: "kpi_code",
    kpi_id: "kpi_code",
    "id do kpi": "kpi_code",

    kpi_name: "kpi_name",
    "nome kpi": "kpi_name",

    kpi_description: "kpi_description",
    "descrição kpi": "kpi_description",

    kpi_target: "kpi_target",
    meta: "kpi_target",
    "meta kpi": "kpi_target",
  }

  return map[s] ?? null
}

function validateRow(r: ImportRow): RowValidation {
  const issues: string[] = []
  if (!norm(r.framework)) issues.push("Framework ausente")
  if (!norm(r.control_code)) issues.push("control_code ausente")
  if (!norm(r.control_name)) issues.push("control_name ausente")
  return { ok: issues.length === 0, issues }
}

function escapeCsv(v: string) {
  const needs = /[,"\n]/.test(v)
  const out = v.replace(/"/g, '""')
  return needs ? `"${out}"` : out
}

function buildTemplateCsv() {
  const header = [
    "framework",
    "control_code",
    "control_name",
    "control_description",
    "control_status",
    "control_frequency",
    "control_type",
    "control_owner_email",
    "focal_point_email",
    "risk_code",
    "risk_name",
    "risk_description",
    "risk_classification",
    "kpi_code",
    "kpi_name",
    "kpi_description",
    "kpi_target",
  ]

  const rows = [
    [
      "ISO27001",
      "ISO27001-CTRL-001",
      "Treinamento de Conscientização em Segurança",
      "Treinar colaboradores e medir conclusão mínima",
      "Ativo",
      "Mensal",
      "Preventivo",
      "grc@empresa.com",
      "securityops@empresa.com",
      "ISO27001-RISK-001",
      "Erro humano e phishing",
      "Risco de incidentes por baixa conscientização e comportamento inseguro",
      "Alto",
      "ISO27001-KPI-001-01",
      "% de conclusão de treinamento",
      "Maior é melhor. Percentual de colaboradores que concluíram o treinamento no mês.",
      "90",
    ],
    [
      "ISO27001",
      "ISO27001-CTRL-001",
      "Treinamento de Conscientização em Segurança",
      "Treinar colaboradores e medir conclusão mínima",
      "Ativo",
      "Mensal",
      "Preventivo",
      "grc@empresa.com",
      "securityops@empresa.com",
      "ISO27001-RISK-001",
      "Erro humano e phishing",
      "Risco de incidentes por baixa conscientização e comportamento inseguro",
      "Alto",
      "ISO27001-KPI-001-02",
      "Taxa de reprovação em phishing simulado (%)",
      "Menor é melhor. Percentual de usuários que clicaram no phishing simulado.",
      "5",
    ],
  ]

  const lines = [header.join(","), ...rows.map((r) => r.map((x) => escapeCsv(String(x))).join(","))]
  return lines.join("\n")
}

function emptyToUndef(v: any) {
  const s = norm(v)
  return s ? s : undefined
}

export default function ImportControlsClient() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState<string>("")
  const [rows, setRows] = useState<ImportRow[]>([])
  const [parseError, setParseError] = useState<string>("")
  const [isPending, startTransition] = useTransition()
  const [resultMsg, setResultMsg] = useState<string>("")

  const validated = useMemo(() => {
    const withValidation = rows.map((r, idx) => {
      const v = validateRow(r)
      return { idx: idx + 1, row: r, v }
    })
    const okCount = withValidation.filter((x) => x.v.ok).length
    const errCount = withValidation.length - okCount
    return { withValidation, okCount, errCount }
  }, [rows])

  const canProcess = rows.length > 0 && validated.errCount === 0 && !isPending

  function onPickFileClick() {
    inputRef.current?.click()
  }

  function clearAll() {
    setFileName("")
    setRows([])
    setParseError("")
    setResultMsg("")
    if (inputRef.current) inputRef.current.value = ""
  }

  function downloadTemplate() {
    const content = buildTemplateCsv()
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "template_controles.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  function parseCsvFile(file: File) {
    setParseError("")
    setResultMsg("")
    setFileName(file.name)

    const ext = file.name.split(".").pop()?.toLowerCase()
    if (ext !== "csv") {
      setParseError("Por enquanto esta tela importa apenas CSV.")
      setRows([])
      return
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      // ajuda quando o CSV vem com delimitador diferente
      delimitersToGuess: [",", ";", "\t", "|"],
      complete: (res) => {
        try {
          const data = (res.data as any[]).filter(Boolean)

          const mapped: ImportRow[] = data.map((raw) => {
            const out: Partial<Record<keyof ImportRow, string>> = {}

            Object.keys(raw || {}).forEach((k) => {
              const nk = normalizeKey(k)
              if (!nk) return // ignora coluna desconhecida
              out[nk] = norm(raw[k])
            })

            // garante o shape completo (com defaults)
            return {
              framework: out.framework || "",
              control_code: out.control_code || "",
              control_name: out.control_name || "",
              control_description: out.control_description,
              control_status: out.control_status,
              control_frequency: out.control_frequency,
              control_type: out.control_type,
              control_owner_email: out.control_owner_email,
              focal_point_email: out.focal_point_email,

              risk_code: out.risk_code,
              risk_name: out.risk_name,
              risk_description: out.risk_description,
              risk_classification: out.risk_classification,

              kpi_code: out.kpi_code,
              kpi_name: out.kpi_name,
              kpi_description: out.kpi_description,
              kpi_target: out.kpi_target,
            }
          })

          // precisa existir pelo menos 1 linha com todos os required preenchidos
          const hasAnyRequired = mapped.some((r) => REQUIRED_KEYS.every((k) => norm((r as any)[k])))
          if (!hasAnyRequired) {
            setParseError("Não consegui identificar as colunas do template. Baixe o Template e tente novamente.")
            setRows([])
            return
          }

          setRows(mapped)
        } catch (e: any) {
          setParseError(e?.message || "Falha ao processar CSV.")
          setRows([])
        }
      },
      error: (err) => {
        setParseError(err?.message || "Falha ao ler arquivo.")
        setRows([])
      },
    })
  }

  async function processImport() {
    setResultMsg("")
    setParseError("")

    // ✅ manda undefined nos vazios (melhor para o server)
    const payload: ImportRow[] = rows.map((r) => ({
      framework: norm(r.framework),
      control_code: norm(r.control_code),
      control_name: norm(r.control_name),

      control_description: emptyToUndef(r.control_description),
      control_status: emptyToUndef(r.control_status),
      control_frequency: emptyToUndef(r.control_frequency),
      control_type: emptyToUndef(r.control_type),
      control_owner_email: emptyToUndef(r.control_owner_email),
      focal_point_email: emptyToUndef(r.focal_point_email),

      risk_code: emptyToUndef(r.risk_code),
      risk_name: emptyToUndef(r.risk_name),
      risk_description: emptyToUndef(r.risk_description),
      risk_classification: emptyToUndef(r.risk_classification),

      kpi_code: emptyToUndef(r.kpi_code),
      kpi_name: emptyToUndef(r.kpi_name),
      kpi_description: emptyToUndef(r.kpi_description),
      kpi_target: emptyToUndef(r.kpi_target),
    }))

    startTransition(async () => {
      try {
        const resp: any = await importarControlesCompleto(payload)

        setResultMsg(
          `Importação concluída: ${resp.controls_imported} controle(s) criado(s), ${resp.controls_updated} atualizado(s), ` +
            `${resp.kpis_imported} KPI(s) criado(s), ${resp.kpis_updated} atualizado(s).`
        )

        if (resp?.errors?.length) {
          setParseError(`Algumas linhas falharam (${resp.errors.length}). Veja o console para detalhes.`)
          console.log("Import errors:", resp.errors)
        }
      } catch (e: any) {
        setParseError(e?.message || "Erro ao processar importação.")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold">Upload de Arquivo</h2>

              <div className="flex items-center gap-2">
                {fileName ? (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
                    title="Limpar arquivo"
                  >
                    <X className="w-4 h-4" />
                    Limpar
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-primary text-sm font-medium hover:bg-slate-50 transition"
                  title="Baixar template"
                >
                  <Download className="w-4 h-4" />
                  Template
                </button>
              </div>
            </div>

            <div
              className={[
                "relative border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center",
                "transition-colors cursor-pointer",
                isDragging ? "border-primary bg-primary/5" : "border-slate-300 bg-slate-50 hover:bg-slate-100",
              ].join(" ")}
              onClick={onPickFileClick}
              onDragEnter={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragging(true)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragging(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragging(false)
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragging(false)
                const f = e.dataTransfer.files?.[0]
                if (f) parseCsvFile(f)
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) parseCsvFile(f)
                }}
              />

              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                <UploadCloud className="w-7 h-7" />
              </div>

              <div className="text-slate-900 font-medium">Arraste e solte seu CSV aqui</div>
              <div className="text-sm text-slate-500 mt-1">ou clique para selecionar</div>

              <div className="mt-4 inline-flex items-center gap-2">
                <span className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono text-slate-500">
                  .CSV
                </span>
              </div>

              {fileName ? (
                <div className="mt-4 text-xs text-slate-500">
                  Arquivo selecionado: <span className="font-mono text-slate-700">{fileName}</span>
                </div>
              ) : null}
            </div>

            {parseError ? (
              <div className="mt-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <span>{parseError}</span>
              </div>
            ) : null}

            {resultMsg ? (
              <div className="mt-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5" />
                <span>{resultMsg}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 h-full">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-primary" />
              <h2 className="text-lg font-semibold">Instruções</h2>
            </div>

            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Use o template para importar controles + riscos + KPIs. Você pode repetir o mesmo <b>control_code</b> em várias
              linhas para criar KPIs diferentes sem duplicar o controle.
            </p>

            <button
              type="button"
              onClick={downloadTemplate}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-primary hover:bg-slate-50 transition"
            >
              <Download className="w-4 h-4" />
              Baixar Template Modelo
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Preview da Importação</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {rows.length === 0 ? (
                <>Nenhuma linha carregada ainda.</>
              ) : (
                <>
                  {rows.length} linhas detectadas •{" "}
                  <span className="text-emerald-700 font-medium">{validated.okCount} válidas</span>
                  {validated.errCount > 0 ? (
                    <>
                      {" "}
                      • <span className="text-red-700 font-medium">{validated.errCount} com erro</span>
                    </>
                  ) : null}
                </>
              )}
            </p>
          </div>

          {rows.length > 0 ? (
            <span
              className={[
                "inline-flex items-center px-2 py-1 rounded text-xs font-medium border",
                validated.errCount === 0
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-700 border-red-200",
              ].join(" ")}
            >
              {validated.errCount === 0 ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Validação OK
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                  Ajuste o CSV
                </>
              )}
            </span>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Controle</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Framework</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Risco</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">KPI</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                  Validação
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {validated.withValidation.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-sm text-slate-500">
                    Faça upload de um CSV para visualizar o preview.
                  </td>
                </tr>
              ) : (
                validated.withValidation.slice(0, 50).map(({ idx, row, v }) => (
                  <tr key={idx} className={v.ok ? "hover:bg-slate-50" : "bg-red-50/40 hover:bg-red-50/60"}>
                    <td className="px-6 py-3 text-sm text-slate-500">{idx}</td>
                    <td className="px-6 py-3 text-sm">
                      <div className="font-mono text-slate-700">{row.control_code || "—"}</div>
                      <div className="text-xs text-slate-500">{row.control_name || "—"}</div>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-700">{row.framework || "—"}</td>
                    <td className="px-6 py-3 text-sm text-slate-700">{row.risk_code || "—"}</td>
                    <td className="px-6 py-3 text-sm text-slate-700">{row.kpi_code || "—"}</td>
                    <td className="px-6 py-3 text-right">
                      {v.ok ? (
                        <span className="text-emerald-600 text-xs font-medium">Sucesso</span>
                      ) : (
                        <span className="inline-flex items-center justify-end gap-1 text-red-600">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">{v.issues[0]}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {validated.withValidation.length > 50 ? (
          <div className="px-6 py-3 text-xs text-slate-500 border-t border-slate-100">
            Mostrando apenas as primeiras 50 linhas no preview.
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-3">
        <Link
          href="/controles"
          className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
        >
          Cancelar
        </Link>

        <button
          type="button"
          disabled={!canProcess}
          onClick={processImport}
          className="px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:opacity-95 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-primary/20 inline-flex items-center gap-2"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Processar Importação
        </button>
      </div>

      <div className="text-xs text-slate-500 flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4" />
        Se sua planilha estiver em Excel, exporte como CSV.
      </div>
    </div>
  )
}
