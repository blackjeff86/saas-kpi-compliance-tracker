// app/(app)/configuracoes/ConfiguracoesClient.tsx
"use client"

import { useMemo, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import SetPageTitle from "../components/SetPageTitle"

type TabKey = "empresa" | "permissoes" | "integracoes"

function clsx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ")
}

function formatCnpj(v: string) {
  const d = (v || "").replace(/\D/g, "").slice(0, 14)
  const p1 = d.slice(0, 2)
  const p2 = d.slice(2, 5)
  const p3 = d.slice(5, 8)
  const p4 = d.slice(8, 12)
  const p5 = d.slice(12, 14)
  let out = p1
  if (p2) out += `.${p2}`
  if (p3) out += `.${p3}`
  if (p4) out += `/${p4}`
  if (p5) out += `-${p5}`
  return out
}

function formatNowHHMM() {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

type IntegrationKey = "slack" | "jira" | "sap"
type IntegrationStatus = "connected" | "available" | "soon"

type ConfiguracoesClientProps = {
  hasRbacPermission?: boolean
}

const RbacClient = dynamic(() => import("../admin/rbac/RbacClient"), {
  loading: () => (
    <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
      Carregando permissões...
    </div>
  ),
})

export default function ConfiguracoesClient({ hasRbacPermission = false }: ConfiguracoesClientProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const [tab, setTab] = useState<TabKey>("empresa")

  useEffect(() => {
    if (tabParam === "permissoes" && hasRbacPermission) {
      setTab("permissoes")
    }
  }, [tabParam, hasRbacPermission])

  // 상태
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  // Empresa
  const [companyName, setCompanyName] = useState("Compliance Solutions LTDA")
  const [cnpj, setCnpj] = useState("12.345.678/0001-90")
  const [sector, setSector] = useState("Tecnologia e SaaS")
  const [adminEmail, setAdminEmail] = useState("admin@compliance.com.br")
  const [language, setLanguage] = useState("pt-BR")
  const [timezone, setTimezone] = useState("UTC-03")

  // Branding (mock)
  const [hasLogo, setHasLogo] = useState(false)

  // Integrações (mock)
  const integrations = useMemo(
    () =>
      [
        {
          key: "slack" as IntegrationKey,
          name: "Slack",
          status: "connected" as IntegrationStatus,
          description: "Envie alertas de conformidade para seus canais.",
          badge: "CONECTADO",
        },
        {
          key: "jira" as IntegrationKey,
          name: "Jira Cloud",
          status: "available" as IntegrationStatus,
          description: "Sincronize tarefas e auditorias com seus projetos.",
          badge: "DISPONÍVEL",
        },
        {
          key: "sap" as IntegrationKey,
          name: "SAP ERP",
          status: "soon" as IntegrationStatus,
          description: "Monitoramento automático de riscos financeiros.",
          badge: "EM BREVE",
        },
      ] as const,
    []
  )

  function touchToast(type: "success" | "error", message: string) {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 3500)
  }

  function validateEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim())
  }

  function tabButton(key: TabKey, label: string, icon: string) {
    const active = tab === key
    return (
      <button
        type="button"
        onClick={() => setTab(key)}
        className={clsx(
          "pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 -mb-px",
          active ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"
        )}
      >
        <span className="text-[14px]">{icon}</span>
        {label}
      </button>
    )
  }

  async function save() {
    setSaving(true)
    try {
      const cleanedCnpj = formatCnpj(cnpj)
      if (cleanedCnpj.replace(/\D/g, "").length !== 14) throw new Error("CNPJ inválido.")
      if (!validateEmail(adminEmail)) throw new Error("E-mail administrativo inválido.")
      if (!companyName.trim()) throw new Error("Informe a razão social.")

      // Aqui você pluga numa Server Action (ex: updateTenantSettings)
      // Por ora, mock:
      setCnpj(cleanedCnpj)
      setLastSavedAt(formatNowHHMM())
      touchToast("success", "Configurações salvas com sucesso!")
    } catch (e: any) {
      touchToast("error", e?.message ?? "Falha ao salvar configurações.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SetPageTitle title="Configurações" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Configurações</h1>
          <div className="mt-1 text-sm text-text-secondary">
            Gerencie as informações da empresa, permissões e integrações do sistema.
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button onClick={save} disabled={saving} className="font-medium">
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8">
          {tabButton("empresa", "Empresa", "🏢")}
          {hasRbacPermission ? tabButton("permissoes", "Permissões", "🛡️") : null}
          {tabButton("integracoes", "Integrações", "🔌")}
        </nav>
      </div>

      {/* Conteúdo */}
      {tab === "empresa" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-semibold mb-6">Informações Corporativas</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Razão Social
                  </label>
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg focus:ring-primary focus:border-primary text-sm p-2.5"
                    type="text"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    CNPJ
                  </label>
                  <input
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                    className="bg-slate-50 border border-slate-200 rounded-lg focus:ring-primary focus:border-primary text-sm p-2.5"
                    type="text"
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Setor Primário
                  </label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg focus:ring-primary focus:border-primary text-sm p-2.5"
                  >
                    <option>Tecnologia e SaaS</option>
                    <option>Financeiro</option>
                    <option>Indústria</option>
                    <option>Saúde</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    E-mail Administrativo
                  </label>
                  <input
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg focus:ring-primary focus:border-primary text-sm p-2.5"
                    type="email"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Preferências de Localidade</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Idioma do Sistema
                  </label>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <span className="text-primary text-sm">🌐</span>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-sm p-0 w-full"
                    >
                      <option value="pt-BR">Português (Brasil)</option>
                      <option value="en-US">English (US)</option>
                      <option value="es-ES">Español</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Fuso Horário
                  </label>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <span className="text-primary text-sm">🕒</span>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-sm p-0 w-full"
                    >
                      <option value="UTC-03">(UTC-03:00) Brasília</option>
                      <option value="UTC-05">(UTC-05:00) New York</option>
                      <option value="UTC+01">(UTC+01:00) London</option>
                    </select>
                  </div>
                </div>
              </div>

              {lastSavedAt ? (
                <div className="mt-4 text-xs text-slate-400">Último save: {lastSavedAt}</div>
              ) : null}
            </div>
          </div>

          {/* Right */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
                Branding
              </h3>

              <div className="flex flex-col items-center gap-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setHasLogo(true)
                    touchToast("success", "Upload (mock) aplicado.")
                  }}
                  className="w-32 h-32 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 hover:border-primary transition-colors"
                >
                  <span className="text-3xl text-slate-400">⬆️</span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {hasLogo ? "LOGO OK" : "UPLOAD LOGO"}
                  </span>
                </button>

                <p className="text-xs text-slate-400 px-4">
                  Tamanho sugerido: 512×512px. JPG ou PNG suportados.
                </p>

                <button
                  type="button"
                  className="text-xs font-semibold text-primary hover:underline"
                  onClick={() => {
                    setHasLogo(false)
                    touchToast("success", "Logo removida (mock).")
                  }}
                >
                  Remover logo atual
                </button>
              </div>
            </div>

            <div className="bg-primary/5 p-6 rounded-xl border border-primary/20">
              <div className="flex items-start gap-3">
                <span className="text-primary">ℹ️</span>
                <div>
                  <h4 className="text-sm font-bold text-primary">Dica de Segurança</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    As alterações feitas aqui afetarão todos os relatórios e documentos exportados pelo sistema.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "integracoes" ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Integrações Sugeridas</h3>
            <button type="button" className="text-primary text-sm font-semibold hover:underline">
              Ver todas
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((it) => (
              <div
                key={it.key}
                className={clsx(
                  "bg-white p-5 rounded-xl border border-slate-200 flex items-start gap-4 hover:shadow-md transition-shadow",
                  it.status === "soon" && "opacity-75"
                )}
              >
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                  <span className="text-slate-700 text-sm">{it.name.slice(0, 2).toUpperCase()}</span>
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-sm">{it.name}</h4>
                    <span
                      className={clsx(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold",
                        it.status === "connected" && "bg-green-100 text-green-700",
                        it.status === "available" && "bg-slate-100 text-slate-600",
                        it.status === "soon" && "bg-blue-100 text-blue-700 uppercase tracking-wide"
                      )}
                    >
                      {it.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-tight">{it.description}</p>

                  <div className="mt-3">
                    {it.status === "available" ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary hover:underline"
                        onClick={() => touchToast("success", `Integração ${it.name} iniciada (mock).`)}
                      >
                        Conectar
                      </button>
                    ) : it.status === "connected" ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-slate-600 hover:underline"
                        onClick={() => touchToast("success", `Integração ${it.name} gerenciada (mock).`)}
                      >
                        Gerenciar
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Em breve</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "permissoes" && hasRbacPermission ? (
        <RbacClient />
      ) : null}

      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-8 right-8 z-50">
          <div
            className={clsx(
              "text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3",
              toast.type === "success" ? "bg-slate-900" : "bg-red-600"
            )}
          >
            <span className={clsx(toast.type === "success" ? "text-green-400" : "text-white")}>
              {toast.type === "success" ? "✔" : "!"}
            </span>
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              type="button"
              className="text-white/70 hover:text-white"
              onClick={() => setToast(null)}
              aria-label="Fechar"
              title="Fechar"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

