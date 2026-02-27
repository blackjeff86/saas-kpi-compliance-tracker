export type AutoStatus =
  | "in_target"
  | "warning"
  | "out_of_target"
  | "unknown"
  | "not_applicable"

type KpiRow = {
  kpi_type?: string | null
  target_operator?: string | null
  target_value?: number | null
}

type ExecRow = {
  result_numeric?: number | null
  result_boolean?: boolean | null
}

function normOp(op?: string | null) {
  const s = (op || "").trim().toLowerCase()

  // símbolos unicode comuns
  if (s === "≥") return "gte"
  if (s === "≤") return "lte"

  // >=
  if (
    s === ">=" ||
    s === "gte" ||
    s === "ge" ||
    s === "gt_or_eq" ||
    s === "higher_better" ||
    s === "higher_is_better" ||
    s === "maior_melhor" ||
    s === "maior_igual_melhor" ||
    (s.includes("greater") && s.includes("equal"))
  )
    return "gte"

  // <=
  if (
    s === "<=" ||
    s === "lte" ||
    s === "le" ||
    s === "lt_or_eq" ||
    s === "lower_better" ||
    s === "lower_is_better" ||
    s === "menor_melhor" ||
    s === "menor_igual_melhor" ||
    (s.includes("less") && s.includes("equal"))
  )
    return "lte"

  // fallback textual (labels legados/localizados)
  if (s.includes("higher") || s.includes("maior") || s.includes("greater")) return "gte"
  if (s.includes("lower") || s.includes("menor") || s.includes("less")) return "lte"

  // =
  if (s === "=" || s === "eq" || s === "equals") return "eq"

  return "unknown"
}

function isBooleanType(kpiType?: string | null) {
  const s = (kpiType || "").trim().toLowerCase()
  return (
    s.includes("bool") ||
    s.includes("boolean") ||
    s === "yesno" ||
    s === "simnao" ||
    s === "sim_nao"
  )
}

export function computeAutoStatus(
  kpi: KpiRow,
  exec: ExecRow,
  bufferPct = 0.05
): AutoStatus {
  const target = kpi.target_value

  // sem meta => unknown (o action pode converter pra not_applicable quando target_value é NULL)
  if (typeof target !== "number" || !Number.isFinite(target)) return "unknown"

  const safeBuffer = typeof bufferPct === "number" && Number.isFinite(bufferPct)
    ? Math.max(0, Math.min(0.5, bufferPct))
    : 0.05

  // O campo Faixa de Warning é o VALOR LIMITE da zona (não percentual de tolerância).
  // Ex: meta 5, warning 7 → zona = 5 até 7. O valor 7 é armazenado como 0.07.
  const warningLimit = safeBuffer * 100

  // boolean: sem yellow
  if (isBooleanType(kpi.kpi_type)) {
    if (typeof exec.result_boolean !== "boolean") return "unknown"
    const expected = target >= 1 // 1 = Sim / 0 = Não
    return exec.result_boolean === expected ? "in_target" : "out_of_target"
  }

  // numérico/%:
  const val = exec.result_numeric
  if (typeof val !== "number" || !Number.isFinite(val)) return "unknown"

  // ✅ FIX: se não tiver operador definido, assume "quanto maior melhor"
  const op = normOp(kpi.target_operator)
  const opSafe = op === "unknown" ? "gte" : op

  // maior melhor (ex.: >= 100): zona warning = [target - limit, target]
  if (opSafe === "gte") {
    if (val >= target) return "in_target"
    const warnFloor = target - warningLimit
    if (val >= warnFloor) return "warning"
    return "out_of_target"
  }

  // menor melhor (ex.: <= 5): zona warning = [target, limit]
  // limit é o valor absoluto configurado (ex: 7 → meta 5 até 7)
  if (opSafe === "lte") {
    if (val <= target) return "in_target"
    const warnCeil = warningLimit
    if (val <= warnCeil) return "warning"
    return "out_of_target"
  }

  // igualdade
  if (opSafe === "eq") return val === target ? "in_target" : "out_of_target"

  return "unknown"
}
