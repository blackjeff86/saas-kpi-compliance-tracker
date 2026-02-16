// app/(app)/PageContainer.tsx
type Variant = "default" | "dashboard" | "form" | "full"

export default function PageContainer({
  children,
  variant = "default",
}: {
  children: React.ReactNode
  variant?: Variant
}) {
  const map: Record<Variant, string> = {
    // ✅ Listas/Dashboards: ocupar a largura do app (sem corredor)
    default: "max-w-none",
    dashboard: "max-w-none",

    // ✅ Formulários: mais estreitos e centralizados
    form: "max-w-[900px] mx-auto",

    // ✅ Full: tudo
    full: "max-w-full",
  }

  return (
    <div className="flex-1 min-w-0">
      {/* padding consistente + sem limite de largura no default/dashboard */}
      <div className={`w-full px-6 py-6 ${map[variant]}`}>
        {children}
      </div>
    </div>
  )
}
