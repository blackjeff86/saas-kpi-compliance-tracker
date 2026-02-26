"use client"

import { useEffect, useState, useTransition } from "react"
import {
  listRbacInitialData,
  listRoles,
  getRolePermissions,
  upsertRolePermissions,
  createTeam,
  updateTeam,
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
  searchUsers,
  getTeamRoles,
  upsertTeamRoles,
  type PermissionRow,
  type RoleRow,
  type TeamRow,
  type TeamMemberRow,
  type UserOption,
} from "./actions"
import { Pencil, Plus, Trash2, X, Users, Shield } from "lucide-react"

type Tab = "roles" | "teams"

export default function RbacClient() {
  const [tab, setTab] = useState<Tab>("roles")
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [permissions, setPermissions] = useState<PermissionRow[]>([])
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  const load = () => {
    setLoading(true)
    startTransition(async () => {
      const data = await listRbacInitialData()
      setRoles(data.roles)
      setPermissions(data.permissions)
      setTeams(data.teams)
      setLoading(false)
    })
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
        Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setTab("roles")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "roles" ? "bg-primary text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Shield className="w-4 h-4" />
          Roles e Permissões
        </button>
        <button
          type="button"
          onClick={() => setTab("teams")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "teams" ? "bg-primary text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Users className="w-4 h-4" />
          Times
        </button>
      </div>

      {tab === "roles" ? (
        <RolesSection
          roles={roles}
          permissions={permissions}
          onRefresh={load}
        />
      ) : (
        <TeamsSection teams={teams} onRefresh={load} />
      )}
    </div>
  )
}

function RolesSection({
  roles,
  permissions,
  onRefresh,
}: {
  roles: RoleRow[]
  permissions: PermissionRow[]
  onRefresh: () => void
}) {
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [checkedPerms, setCheckedPerms] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  const permsByModule = permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = []
    acc[p.module].push(p)
    return acc
  }, {} as Record<string, PermissionRow[]>)

  async function openEdit(roleId: string) {
    const perms = await getRolePermissions(roleId)
    setCheckedPerms(perms)
    setEditingRoleId(roleId)
  }

  async function saveRolePermissions() {
    if (!editingRoleId) return
    startTransition(async () => {
      await upsertRolePermissions(editingRoleId, Array.from(checkedPerms))
      setEditingRoleId(null)
      onRefresh()
    })
  }

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="p-4 border-b bg-slate-50">
        <h3 className="font-bold text-slate-900">Perfis (roles)</h3>
        <p className="text-xs text-slate-500 mt-1">
          Edite as permissões de cada perfil. Novos perfis não podem ser criados.
        </p>
      </div>
      <div className="divide-y">
        {roles.map((r) => (
          <div key={r.id} className="p-4 flex items-start justify-between gap-4">
            <div>
              <span className="font-semibold text-slate-900">{r.name}</span>
              {r.description ? (
                <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>
              ) : null}
            </div>
            {editingRoleId === r.id ? (
              <div className="flex-1 max-w-2xl">
                <div className="text-xs font-semibold text-slate-500 mb-2">Permissões (por módulo)</div>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {Object.entries(permsByModule).map(([module, perms]) => (
                    <div key={module}>
                      <div className="text-[11px] font-bold text-slate-400 uppercase">{module}</div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {perms.map((p) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-1.5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checkedPerms.has(p.key)}
                              onChange={(e) => {
                                setCheckedPerms((prev) => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(p.key)
                                  else next.delete(p.key)
                                  return next
                                })
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={saveRolePermissions}
                    disabled={pending}
                    className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg"
                  >
                    {pending ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRoleId(null)}
                    className="px-3 py-1.5 text-sm border rounded-lg"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openEdit(r.id)}
                className="inline-flex items-center gap-1 px-2 py-1 text-sm text-primary hover:bg-primary/10 rounded"
              >
                <Pencil className="w-4 h-4" />
                Editar permissões
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamsSection({ teams, onRefresh }: { teams: TeamRow[]; onRefresh: () => void }) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [members, setMembers] = useState<TeamMemberRow[]>([])
  const [teamRoles, setTeamRoles] = useState<Set<string>>(new Set())
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [creating, setCreating] = useState(false)
  const [newTeamName, setNewTeamName] = useState("")
  const [userSearch, setUserSearch] = useState("")
  const [userResults, setUserResults] = useState<UserOption[]>([])
  const [pending, startTransition] = useTransition()

  async function loadTeamDetail(teamId: string) {
    setSelectedTeamId(teamId)
    const [m, tr, r] = await Promise.all([
      getTeamMembers(teamId),
      getTeamRoles(teamId),
      listRoles(),
    ])
    setMembers(m)
    setTeamRoles(tr)
    setRoles(r)
  }

  async function doCreateTeam() {
    if (!newTeamName.trim()) return
    startTransition(async () => {
      const id = await createTeam(newTeamName.trim())
      setCreating(false)
      setNewTeamName("")
      onRefresh()
      if (id) loadTeamDetail(id)
    })
  }

  async function doSearchUsers() {
    const res = await searchUsers(userSearch)
    setUserResults(res)
  }

  async function doAddMember(userId: string) {
    if (!selectedTeamId) return
    startTransition(async () => {
      await addTeamMember(selectedTeamId, userId)
      loadTeamDetail(selectedTeamId)
      setUserSearch("")
      setUserResults([])
    })
  }

  async function doRemoveMember(userId: string) {
    if (!selectedTeamId) return
    startTransition(async () => {
      await removeTeamMember(selectedTeamId, userId)
      loadTeamDetail(selectedTeamId)
    })
  }

  async function doUpsertTeamRoles() {
    if (!selectedTeamId) return
    startTransition(async () => {
      await upsertTeamRoles(selectedTeamId, Array.from(teamRoles))
      loadTeamDetail(selectedTeamId)
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Times</h3>
          {!creating ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Criar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Nome do time"
                className="px-3 py-1.5 border rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={doCreateTeam}
                disabled={pending || !newTeamName.trim()}
                className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg"
              >
                Criar
              </button>
              <button
                type="button"
                onClick={() => { setCreating(false); setNewTeamName("") }}
                className="p-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="divide-y max-h-80 overflow-y-auto">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => loadTeamDetail(t.id)}
              className={`w-full px-4 py-3 text-left flex items-center justify-between ${
                selectedTeamId === t.id ? "bg-primary/10" : "hover:bg-slate-50"
              }`}
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-xs text-slate-500">{t.member_count} membros</span>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        {selectedTeamId ? (
          <>
            <div className="rounded-xl border bg-white p-4">
              <h3 className="font-bold text-slate-900 mb-3">Membros</h3>
              <div className="flex gap-2 mb-3">
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearchUsers()}
                  placeholder="Buscar por nome ou email..."
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={doSearchUsers}
                  className="px-3 py-2 text-sm bg-slate-100 rounded-lg"
                >
                  Buscar
                </button>
              </div>
              {userResults.length > 0 && (
                <div className="mb-3 p-2 border rounded bg-slate-50">
                  {userResults.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm">{u.name} &lt;{u.email}&gt;</span>
                      <button
                        type="button"
                        onClick={() => doAddMember(u.id)}
                        disabled={pending}
                        className="text-xs text-primary hover:underline"
                      >
                        Adicionar
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-1">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span className="text-sm">{m.user_name} &lt;{m.user_email}&gt;</span>
                    <button
                      type="button"
                      onClick={() => doRemoveMember(m.user_id)}
                      disabled={pending}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <h3 className="font-bold text-slate-900 mb-3">Roles do Time</h3>
              <div className="flex flex-wrap gap-3">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={teamRoles.has(r.id)}
                      onChange={(e) => {
                        setTeamRoles((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(r.id)
                          else next.delete(r.id)
                          return next
                        })
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{r.name}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={doUpsertTeamRoles}
                disabled={pending}
                className="mt-3 px-3 py-1.5 text-sm bg-primary text-white rounded-lg"
              >
                {pending ? "Salvando..." : "Salvar roles"}
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
            Selecione um time para ver membros e atribuir roles.
          </div>
        )}
      </div>
    </div>
  )
}
