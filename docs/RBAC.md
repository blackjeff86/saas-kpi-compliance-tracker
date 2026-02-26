# RBAC — Controle de Acesso Baseado em Roles e Times

Este documento descreve a racionalidade e o funcionamento do sistema RBAC (Role-Based Access Control) estruturado no projeto KPI Compliance.

---

## 1. Visão geral

O RBAC implementa **controle de acesso baseado em perfis (roles) e times (teams)**. Em resumo:

- **Usuários** pertencem a **times**
- **Times** recebem **roles** (perfis)
- **Roles** possuem **permissões**
- O acesso é calculado por: **Usuário → Times → Roles → Permissões**

Isso permite segregação de dados (ex.: visão restrita ao próprio time) e controle fino de ações (visualizar, editar, etc.).

---

## 2. Modelo de dados

### 2.1 Entidades principais

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   users     │     │ team_members │     │   teams     │
│─────────────│     │──────────────│     │─────────────│
│ id          │─────│ user_id      │     │ id          │
│ tenant_id   │     │ team_id  ────│─────│ tenant_id   │
│ name, email │     │ tenant_id    │     │ name        │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                                                │ team_roles
                                                ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  permissions    │◄────│ role_permissions │────►│   roles     │
│─────────────────│     │──────────────────│     │─────────────│
│ id              │     │ role_id          │     │ id          │
│ tenant_id       │     │ permission_id    │     │ tenant_id   │
│ key (ex: ...)   │     │ tenant_id        │     │ name        │
│ label, module   │     └──────────────────┘     │ description │
└─────────────────┘                              └─────────────┘
```

### 2.2 Caminho de herança de permissões

```
Usuário
  └── pertence a times (team_members)
        └── cada time possui roles (team_roles)
              └── cada role possui permissões (role_permissions)
                    └── permissões (permissions)
```

O usuário tem **todas** as permissões das roles atribuídas aos times de que participa.

---

## 3. Conceitos principais

### 3.1 Multi-tenancy

Todas as tabelas RBAC possuem `tenant_id`. Os dados são isolados por tenant (empresa/cliente).

### 3.2 Times (teams)

- Unidade de agrupamento de usuários.
- Ex.: "Compliance TI", "Auditoria Interna", "Default".
- Todo usuário deve pertencer a pelo menos um time; caso contrário é incluído automaticamente no time "Default".

### 3.3 Roles (perfis)

- Conjunto de permissões.
- São **predefinidas** — o usuário não cria novas roles, apenas ajusta permissões das existentes.
- Perfis padrão:
  - **Admin** — acesso total
  - **Analista** — Compliance Officer
  - **Revisor GRC** — revisões e evidências
  - **Operador** — visão restrita ao time
  - **Auditor** — campanhas e evidências de auditoria

### 3.4 Permissões

Padrão `módulo:ação`:

- `dashboard:view` / `dashboard:view_all`
- `controls:view` / `controls:view_all` / `controls:edit`
- `risks:view` / `risks:view_all` / `risks:edit`
- `action_plans:view` / `action_plans:view_all` / `action_plans:edit`
- `audit_campaigns:view` / `audit_campaigns:view_all` / `audit_campaigns:create` / `audit_campaigns:edit`
- `evidence_requests:view` / `evidence_requests:view_all` / `evidence_requests:create` / `evidence_requests:review`
- `rbac_admin:manage` — administração do RBAC

### 3.5 Escopo (view vs view_all)

- **`view`** — apenas dados do próprio time (`team_id IN (teams do usuário)`).
- **`view_all`** — todos os registros do tenant, sem filtro de time.

---

## 4. Fluxo de verificação

### 4.1 Permissões efetivas

```ts
// lib/authz.ts
getEffectivePermissions(tenantId, userId)
```

- Junta `team_members` → `team_roles` → `role_permissions` → `permissions`.
- Retorna o conjunto de `key` de permissões do usuário.
- Usado para checagens do tipo: `perms.has("controls:edit")`.

### 4.2 Times do usuário

```ts
// lib/authz.ts
getUserTeams(tenantId, userId)
```

- Retorna os IDs dos times do usuário.
- Se não pertencer a nenhum time → atribuído ao time "Default".

### 4.3 Filtro de escopo

```ts
// lib/authz.ts
buildScopeFilter(tenantId, userId, { allowAllPermissionKey })
```

Retorna:

- `canViewAll`: `true` se o usuário tiver a permissão `allowAllPermissionKey` (ex.: `controls:view_all`).
- `teamIds`: IDs dos times do usuário.

Com isso, as queries podem ser montadas assim:

- Se `canViewAll` → sem filtro de time.
- Caso contrário → `WHERE team_id IS NULL OR team_id IN (teamIds)`.

---

## 5. Uso nas páginas e actions

### 5.1 Dashboard

```ts
// dashboard/actions.ts
const scope = await getDashboardScope(tenantId, ctx.userId)
// scope.canViewAll → dashboard:view_all
// scope.teamIds → times do usuário
// Query usa filtro por team_id quando canViewAll = false
```

### 5.2 Controles, Riscos, Planos de Ação, Auditorias

Mesmo padrão:

- `getControlsScope`
- `getRisksScope`
- `getActionPlansScope`
- `getAuditCampaignsScope`

Cada um retorna `{ canViewAll, teamIds }` usado para filtrar as consultas.

### 5.3 Aba RBAC (Configurações → Permissões)

```ts
// admin/rbac/actions.ts
await requirePermission(ctx.tenantId, ctx.userId, "rbac_admin:manage")
```

Apenas usuários com `rbac_admin:manage` acessam a gestão de roles, times e permissões.

---

## 6. Vínculo com dados de negócio (team_id)

As tabelas de dados possuem `team_id`:

- `controls`
- `risk_catalog`
- `action_plans`
- `audit_campaigns`

Regras práticas:

- Se `team_id` for `NULL` → registro compartilhado (visível para todos os times, quando o escopo permitir).
- Se `team_id` tiver valor → registro específico do time; usuários do time veem; usuários com `view_all` também veem.

---

## 7. Bootstrap e seeds

### 7.1 Ordem de inicialização

1. **ensureRbacTables()** — cria tabelas RBAC se não existirem.
2. **seedBasePermissions()** — insere as permissões base do tenant.
3. **ensureDefaultTeamAdminRole()** — garante o time "Default" e a role "Admin" com todas as permissões.
4. **seedBaseRoles()** — garante as roles base (Admin, Analista, Revisor GRC, Operador, Auditor).
5. **ensureTeamIdColumns()** — adiciona `team_id` nas tabelas de negócio e preenche com o time Default onde for NULL.

### 7.2 Garantia de acesso inicial

- Todo usuário sem time é colocado no time "Default".
- O time "Default" recebe a role "Admin".
- A role "Admin" tem todas as permissões, incluindo `rbac_admin:manage`.
- Assim, o primeiro uso não fica bloqueado.

---

## 8. Arquivos relevantes

| Arquivo | Responsabilidade |
|---------|------------------|
| `lib/authz.ts` | `getUserTeams`, `getEffectivePermissions`, `requirePermission`, `buildScopeFilter`, helpers de escopo por módulo |
| `lib/rbac-schema.ts` | Criação das tabelas RBAC |
| `lib/rbac-seed.ts` | Seeds de permissões e roles |
| `lib/rbac-migrations.ts` | Coluna `team_id` em tabelas de negócio |
| `admin/rbac/actions.ts` | Actions da aba Permissões |
| `admin/rbac/RbacClient.tsx` | UI de gestão (roles e times) |

---

## 9. Exemplo prático

**Usuário João**

- Time: "Compliance TI"
- Roles do time: "Analista"

**Role Analista**

- `controls:view_all`, `controls:edit`
- `risks:view_all`, `risks:edit`
- etc.

**Resultado**

- João vê todos os controles e riscos (view_all).
- João pode editar controles e riscos (edit).
- João não vê a aba Permissões (não tem `rbac_admin:manage`).

---

## 10. Restrições

- **Criação de roles** — desabilitada; apenas edição de permissões das roles predefinidas.
- **Criação de times** — permitida para usuários com `rbac_admin:manage`.
- **Segregação** — aplicada em listagens e consultas; páginas de detalhe usam principalmente `tenant_id` (podendo ter checagens adicionais conforme o módulo).
