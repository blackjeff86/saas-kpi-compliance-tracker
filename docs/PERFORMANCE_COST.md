# Performance e Custo (Multi-tenant)

## Objetivo
- Reduzir tempo de troca de páginas.
- Reduzir custo de hospedagem/transações no banco.
- Manter isolamento por `tenant_id` e escopo por times.

## Métricas recomendadas
- P50/P95 de resposta por rota:
  - `/dashboard`
  - `/action-plans`
  - `/controles`
  - `/risks`
  - `/configuracoes?tab=permissoes`
- Número de queries por rota.
- Tempo total de DB por rota.
- Linhas retornadas por query (quando disponível no monitor do banco).

## Query de diagnóstico (Postgres com pg_stat_statements)
```sql
SELECT
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round((total_exec_time / NULLIF(calls, 0))::numeric, 2) AS avg_ms,
  rows,
  left(query, 300) AS sample_query
FROM pg_stat_statements
WHERE query ILIKE '%risk_catalog%'
   OR query ILIKE '%action_plans%'
   OR query ILIKE '%controls%'
   OR query ILIKE '%kpi_executions%'
ORDER BY total_exec_time DESC
LIMIT 50;
```

## Índices
- Script: `scripts/add-performance-indexes.sql`
- Todos os índices começam com `tenant_id` para preservar eficiência em SaaS multi-tenant.

## O que já foi otimizado no app
- Dashboard: queries realmente paralelas.
- Riscos: heatmap agregado no SQL (sem trazer lista inteira para memória).
- Controles: summary agregado no SQL (sem recalcular lista inteira em JS).
- Planos de Ação: filtros com menos transações e filtro de teams indexável.
- Configurações/Permissões: módulo RBAC carregado sob demanda.

## Próxima etapa sugerida
- Medir por 48h após deploy e comparar:
  - latência p95 por rota
  - total de chamadas ao banco
  - tempo médio das top 20 queries
- Runbook pronto: `docs/PROD_PERF_RUNBOOK.md`
- Scripts prontos: `scripts/perf/*.sql`
