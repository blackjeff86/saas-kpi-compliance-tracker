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

  // >=
  if (
    s === ">=" ||
    s === "gte" ||
    s === "ge" ||
    s === "gt_or_eq" ||
    s.includes("greater") && s.includes("equal")
  ) return "gte"

  // <=
  if (
    s === "<=" ||
    s === "lte" ||
    s === "le" ||
    s === "lt_or_eq" ||
    s.includes("less") && s.includes("equal")
  ) return "lte"

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
  const op = normOp(kpi.target_operator)
  const target = kpi.target_value

  // sem meta => unknown (o action já converte pra not_applicable quando target_value é NULL)
  if (typeof target !== "number") return "unknown"

  // boolean: sem yellow
  if (isBooleanType(kpi.kpi_type)) {
    if (typeof exec.result_boolean !== "boolean") return "unknown"
    const expected = target >= 1
    return exec.result_boolean === expected ? "in_target" : "out_of_target"
  }

  // numérico/%:
  const val = exec.result_numeric
  if (typeof val !== "number") return "unknown"

  // maior melhor
  if (op === "gte") {
    if (val >= target) return "in_target"
    const warnFloor = target * (1 - bufferPct)
    if (val >= warnFloor) return "warning"
    return "out_of_target"
  }

  // menor melhor
  if (op === "lte") {
    if (val <= target) return "in_target"
    const warnCeil = target * (1 + bufferPct)
    if (val <= warnCeil) return "warning"
    return "out_of_target"
  }

  // igualdade
  if (op === "eq") return val === target ? "in_target" : "out_of_target"

  return "unknown"
}
