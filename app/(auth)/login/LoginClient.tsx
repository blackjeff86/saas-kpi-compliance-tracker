"use client"

import React, { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldCheck, Mail, Lock, Eye, EyeOff, Shield, LineChart, Scale } from "lucide-react"
import Image from "next/image"

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()

  const nextPath = useMemo(() => {
    const n = params.get("next")
    return n && n.startsWith("/") ? n : "/dashboard"
  }, [params])

  const [showPassword, setShowPassword] = useState(false)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    router.push(nextPath)
  }

  return (
    <div className="h-[100svh] w-full overflow-hidden bg-white text-slate-900 antialiased">
      <div className="flex h-full w-full">
        {/* LEFT PANEL (desktop) */}
        <div className="relative hidden w-1/2 items-center justify-center overflow-hidden lg:flex">
          <div className="absolute inset-0 bg-primary" />

          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="absolute left-[-10%] top-[-10%] h-96 w-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-blue-400/10 blur-3xl" />

          <div className="relative z-10 flex flex-col items-center px-12 py-16 text-center">
            <div className="mb-4 flex items-center justify-center">
              <Image
                src="/logo3.png"
                alt="KPI Compliance Tracker"
                width={160}
                height={160}
                priority
                unoptimized
                className="h-28 w-auto object-contain"
              />
            </div>

            <h1 className="mb-4 text-4xl font-bold tracking-tight text-white">
              KPI Compliance Tracker
            </h1>

            <p className="max-w-md text-lg font-light leading-relaxed text-blue-100">
              Plataforma SaaS para gestão de Governança, Riscos, Controles e KPIs.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-8 text-sm text-white/80">
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-lg bg-white/10 p-2">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <span>Segurança</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="rounded-lg bg-white/10 p-2">
                  <LineChart className="h-5 w-5 text-white" />
                </div>
                <span>KPIs</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="rounded-lg bg-white/10 p-2">
                  <Scale className="h-5 w-5 text-white" />
                </div>
                <span>Compliance</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="relative flex w-full flex-col items-center justify-center overflow-y-auto bg-white p-8 sm:p-12 lg:w-1/2 lg:p-24">
          <div className="w-full max-w-md space-y-8">

            {/* Mobile logo */}
            <div className="flex justify-center lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
            </div>

            <div className="text-center lg:text-left space-y-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                  Bem-vindo de volta
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Faça login para acessar o dashboard.
                </p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="mt-8 space-y-6">
              <div className="space-y-5">

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    E-mail
                  </label>
                  <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="seu.email@empresa.com"
                      className="block w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Senha
                  </label>
                  <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>

                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="block w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-10 text-sm placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
                  onClick={() => alert("Backlog: fluxo de recuperação de senha")}
                >
                  Esqueceu sua senha?
                </button>
              </div>

              <div className="space-y-4">
                <button
                  type="submit"
                  className="group relative flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  Entrar
                </button>
              </div>
            </form>

            <p className="mt-8 text-center text-sm text-slate-600">
              Não tem uma conta?{" "}
              <button
                type="button"
                className="font-medium text-primary hover:text-primary-hover transition-colors"
                onClick={() => alert("Backlog: solicitar acesso / onboarding")}
              >
                Solicite acesso
              </button>
            </p>
          </div>

          <div className="absolute bottom-6 text-xs text-slate-400">
            © {new Date().getFullYear()} KPI Compliance Tracker. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </div>
  )
}
