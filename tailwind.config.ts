import type { Config } from "tailwindcss"

const config: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        /* Accent (CIANO - principal) */
        accent: "#06B6D4",
        "accent-hover": "#0891B2",
        "accent-pressed": "#0E7490",
        "accent-soft": "rgba(6,182,212,0.12)",
        "accent-ring": "rgba(6,182,212,0.35)",

        /* Surface & Background */
        background: "#F6F8FC",
        surface: "#FFFFFF",
        "surface-subtle": "#F2F6FF",
        border: "#E6ECF5",

        /* Text */
        "text-primary": "#0F172A",
        "text-secondary": "#475569",
        "text-muted": "#64748B",

        /* Sidebar */
        sidebar: "#0B1220",
        "sidebar-hover": "rgba(255,255,255,0.05)",
        "sidebar-active": "#06B6D4",
        "sidebar-divider": "rgba(255,255,255,0.06)",

        /* Semantic */
        success: "#10B981",
        "success-soft": "rgba(16,185,129,0.14)",
        warning: "#F59E0B",
        "warning-soft": "rgba(245,158,11,0.16)",
        danger: "#EF4444",
        "danger-soft": "rgba(239,68,68,0.14)",
        info: "#3B82F6",
        "info-soft": "rgba(59,130,246,0.14)",

        /* Alias para compatibilidade */
        primary: "#06B6D4",
        "primary-hover": "#0891B2",
        risk: {
          critical: "#EF4444",
          high: "#F97316",
          medium: "#EAB308",
          low: "#22C55E",
        },
      },
    },
  },
  plugins: [],
}

export default config
