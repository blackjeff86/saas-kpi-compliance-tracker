// app/(app)/layout.tsx
import AppHeader from "./AppHeader"
import SidebarNav from "./SidebarNav"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = {
    name: "Ricardo Mendes",
    role: "Compliance Officer",
    email: "admin@demo.com",
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* SIDEBAR */}
      <aside className="no-print w-64 bg-white border-r hidden md:flex flex-col">
        <div className="h-14 flex items-center px-6 border-b">
          <span className="font-semibold text-lg tracking-tight text-slate-800">
            KPI Compliance
          </span>
        </div>

        <SidebarNav />
      </aside>

      {/* CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <div className="no-print">
          <AppHeader user={user} />
        </div>
        {children}
      </div>
    </div>
  )
}
