# Runbook de Performance em Produção

## Pré-requisitos
- Banco com `pg_stat_statements` habilitado.
- Acesso SQL com permissão para `SELECT` em `pg_stat_statements` e `CREATE TABLE` no schema alvo.

## 1) Preparar snapshots
```sql
\i scripts/perf/create_perf_snapshot_tables.sql
```

## 2) Capturar baseline (antes)
```sql
\set run_label 'baseline_2026_02_28'
\i scripts/perf/capture_snapshot.sql
```

## 3) Deploy da versão otimizada
- Deploy normal da aplicação.
- Aguardar janela de tráfego comparável (ex.: 24h).

## 4) Capturar snapshot pós-deploy
```sql
\set run_label 'after_phase3_2026_02_28'
\i scripts/perf/capture_snapshot.sql
```

## 5) Comparar
```sql
\set baseline 'baseline_2026_02_28'
\set candidate 'after_phase3_2026_02_28'
\i scripts/perf/compare_snapshots.sql
```

## 6) Consultar top queries atuais
```sql
\i scripts/perf/top_queries_now.sql
```

## Interpretação rápida
- `delta_total_ms < 0`: melhora no custo total.
- `delta_avg_ms < 0`: melhora de latência média por chamada.
- `delta_calls`: ajuda a validar se houve redução de roundtrips.
- `delta_rows`: indica variação de volume retornado (payload do banco).

## Modelo de relatório (preencher)
- Janela baseline: `...`
- Janela pós: `...`
- Top 10 queries com maior redução de `delta_total_ms`: `...`
- Rotas com maior melhora de p95: `...`
- Alertas/regressões detectadas: `...`
