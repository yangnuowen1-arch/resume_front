import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Edit3, LoaderCircle, Plus, Save, Search, ShieldCheck, UserCog, Users, X } from "lucide-react";
import {
  assignUserRoles,
  createUser,
  listRoles,
  listUsers,
  updateUser,
  type ApiId,
  type CreateUserRequest,
  type RoleOption,
  type UpdateUserRequest,
  type User,
  type UserStatus,
} from "../../api";
import { isRequestError, queryClient } from "../../request";

type TabId = "users" | "roles";
type ModalId = "user" | "roles" | null;

interface UserFormState {
  username: string;
  password: string;
  realName: string;
  email: string;
  phone: string;
  status: UserStatus;
  roles: string[];
}

const defaultUserForm: UserFormState = {
  username: "",
  password: "",
  realName: "",
  email: "",
  phone: "",
  status: "active",
  roles: [],
};

function getErrorMessage(error: unknown, fallback: string): string {
  return isRequestError(error) ? error.message : fallback;
}

function getRoleValue(role: RoleOption): string {
  if (typeof role === "string") {
    return role;
  }
  return role.code ?? role.name ?? (role.id === undefined ? "" : String(role.id));
}

function getRoleLabel(role: RoleOption): string {
  if (typeof role === "string") {
    return role;
  }
  if (role.name && role.code && role.name !== role.code) {
    return `${role.name} (${role.code})`;
  }
  return role.name ?? role.code ?? (role.id === undefined ? "Unknown role" : String(role.id));
}

function normalizeRoles(roles: RoleOption[] | undefined): string[] {
  return (roles ?? []).map(getRoleValue).filter(Boolean);
}

function getStatusStyle(status: string): string {
  return status === "active" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200";
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<TabId>("users");
  const [modal, setModal] = useState<ModalId>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>(defaultUserForm);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");

  const usersQuery = useQuery({
    queryKey: ["users", { keyword, status }],
    queryFn: () =>
      listUsers({
        page: 1,
        pageSize: 50,
        keyword: keyword || undefined,
        status: status || undefined,
      }),
  });

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: listRoles,
  });

  const roleOptions = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const roleLabelByValue = useMemo(() => {
    const map = new Map<string, string>();
    roleOptions.forEach((role) => map.set(getRoleValue(role), getRoleLabel(role)));
    return map;
  }, [roleOptions]);

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to create user.")),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: ApiId; payload: UpdateUserRequest }) => updateUser(id, payload),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to update user.")),
  });

  const assignRolesMutation = useMutation({
    mutationFn: ({ id, roles }: { id: ApiId; roles: string[] }) => assignUserRoles(id, { roles }),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to assign roles.")),
  });

  const closeModal = () => {
    setModal(null);
    setFormError(null);
    setSelectedUser(null);
    setUserForm(defaultUserForm);
  };

  const openCreateUser = () => {
    setSelectedUser(null);
    setUserForm(defaultUserForm);
    setFormError(null);
    setModal("user");
  };

  const openEditUser = (user: User) => {
    setSelectedUser(user);
    setUserForm({
      username: user.username ?? "",
      password: "",
      realName: user.realName ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      status: user.status === "disabled" ? "disabled" : "active",
      roles: normalizeRoles(user.roles),
    });
    setFormError(null);
    setModal("user");
  };

  const openAssignRoles = (user: User) => {
    setSelectedUser(user);
    setUserForm({
      ...defaultUserForm,
      username: user.username ?? "",
      roles: normalizeRoles(user.roles),
    });
    setFormError(null);
    setModal("roles");
  };

  const toggleRole = (role: string) => {
    setUserForm((current) => {
      const roles = current.roles.includes(role) ? current.roles.filter((item) => item !== role) : [...current.roles, role];
      return { ...current, roles };
    });
  };

  const submitUser = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const username = userForm.username.trim();
    if (!username) {
      setFormError("Username is required.");
      return;
    }

    if (selectedUser) {
      const payload: UpdateUserRequest = {
        username,
        realName: userForm.realName.trim() || undefined,
        email: userForm.email.trim() || undefined,
        phone: userForm.phone.trim() || undefined,
        status: userForm.status,
      };
      updateUserMutation.mutate({ id: selectedUser.id, payload });
      return;
    }

    if (!userForm.password.trim()) {
      setFormError("Password is required.");
      return;
    }

    const payload: CreateUserRequest = {
      username,
      password: userForm.password,
      realName: userForm.realName.trim() || undefined,
      email: userForm.email.trim() || undefined,
      phone: userForm.phone.trim() || undefined,
      status: userForm.status,
      roles: userForm.roles.length > 0 ? userForm.roles : undefined,
    };
    createUserMutation.mutate(payload);
  };

  const submitRoles = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!selectedUser) {
      return;
    }
    assignRolesMutation.mutate({ id: selectedUser.id, roles: userForm.roles });
  };

  const isSaving = createUserMutation.isPending || updateUserMutation.isPending || assignRolesMutation.isPending;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:mb-8">
        <div>
          <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">User Management</h1>
          <p className="text-sm text-gray-600 md:text-base">Manage system users and role assignments.</p>
        </div>
        {activeTab === "users" && (
          <button type="button" onClick={openCreateUser} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white shadow-sm hover:bg-blue-700 md:text-base">
            <Plus className="h-5 w-5" />
            Create User
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
        <TabButton active={activeTab === "users"} icon={<Users className="h-4 w-4" />} label="Users" onClick={() => setActiveTab("users")} />
        <TabButton active={activeTab === "roles"} icon={<ShieldCheck className="h-4 w-4" />} label="Roles" onClick={() => setActiveTab("roles")} />
      </div>

      {activeTab === "users" && (
        <section className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
              <SearchBox value={keywordInput} placeholder="Search username, name, email, phone..." onChange={setKeywordInput} onSubmit={() => setKeyword(keywordInput.trim())} />
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
              <button type="button" onClick={() => setKeyword(keywordInput.trim())} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
                Search
              </button>
            </div>
          </div>

          <QueryState loading={usersQuery.isLoading} error={usersQuery.error} fallback="Failed to load users." />
          {!usersQuery.isLoading && !usersQuery.isError && (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3 text-sm text-gray-500">Total {usersQuery.data?.total ?? 0} users</div>
              <div className="divide-y divide-gray-200">
                {(usersQuery.data?.items ?? []).map((user) => (
                  <div key={String(user.id)} className="p-4 transition-colors hover:bg-gray-50">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-semibold text-gray-900">{user.realName || user.username}</h3>
                          <StatusBadge value={user.status} />
                          <span className="text-sm text-gray-500">@{user.username}</span>
                        </div>
                        <div className="grid gap-2 text-sm text-gray-600 md:grid-cols-3">
                          <span>Email: {user.email || "-"}</span>
                          <span>Phone: {user.phone || "-"}</span>
                          <span>ID: {String(user.id)}</span>
                        </div>
                        <RoleChips roles={user.roles} labelByValue={roleLabelByValue} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openEditUser(user)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </button>
                        <button type="button" onClick={() => openAssignRoles(user)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                          <UserCog className="h-4 w-4" />
                          Roles
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {(usersQuery.data?.items ?? []).length === 0 && <EmptyState label="No users found." />}
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === "roles" && (
        <section className="space-y-4">
          <QueryState loading={rolesQuery.isLoading} error={rolesQuery.error} fallback="Failed to load roles." />
          {!rolesQuery.isLoading && !rolesQuery.isError && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {roleOptions.map((role) => (
                <div key={getRoleValue(role)} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-gray-900">{getRoleLabel(role)}</h3>
                      <p className="mt-1 text-sm text-gray-500">Value: {getRoleValue(role)}</p>
                    </div>
                    <ShieldCheck className="h-5 w-5 text-blue-600" />
                  </div>
                  {typeof role !== "string" && <p className="text-sm text-gray-600">{role.description || "No description."}</p>}
                </div>
              ))}
              {roleOptions.length === 0 && <EmptyState label="No roles found." />}
            </div>
          )}
        </section>
      )}

      {modal === "user" && (
        <Modal title={selectedUser ? "Edit User" : "Create User"} onClose={closeModal}>
          <form onSubmit={submitUser} className="space-y-5 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Username" value={userForm.username} onChange={(value) => setUserForm({ ...userForm, username: value })} required />
              {!selectedUser && <Field label="Password" type="password" value={userForm.password} onChange={(value) => setUserForm({ ...userForm, password: value })} required />}
              <Field label="Name" value={userForm.realName} onChange={(value) => setUserForm({ ...userForm, realName: value })} />
              <Field label="Email" type="email" value={userForm.email} onChange={(value) => setUserForm({ ...userForm, email: value })} />
              <Field label="Phone" value={userForm.phone} onChange={(value) => setUserForm({ ...userForm, phone: value })} />
              <SelectField label="Status" value={userForm.status} onChange={(value) => setUserForm({ ...userForm, status: value as UserStatus })} options={["active", "disabled"]} />
            </div>
            {!selectedUser && <RoleCheckboxes roles={roleOptions} selected={userForm.roles} onToggle={toggleRole} />}
            <FormActions error={formError} isSaving={isSaving} onCancel={closeModal} />
          </form>
        </Modal>
      )}

      {modal === "roles" && selectedUser && (
        <Modal title={`Assign Roles: ${selectedUser.realName || selectedUser.username}`} onClose={closeModal}>
          <form onSubmit={submitRoles} className="space-y-5 p-6">
            <RoleCheckboxes roles={roleOptions} selected={userForm.roles} onToggle={toggleRole} />
            <FormActions error={formError} isSaving={isSaving} onCancel={closeModal} />
          </form>
        </Modal>
      )}
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
      {icon}
      {label}
    </button>
  );
}

function SearchBox({ value, placeholder, onChange, onSubmit }: { value: string; placeholder: string; onChange: (value: string) => void; onSubmit: () => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSubmit();
          }
        }}
        className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function QueryState({ loading, error, fallback }: { loading: boolean; error: unknown; fallback: string }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-gray-600 shadow-sm">
        <div className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">{getErrorMessage(error, fallback)}</div>;
  }

  return null;
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">{label}</div>;
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${getStatusStyle(value)}`}>{value}</span>;
}

function RoleChips({ roles, labelByValue }: { roles: RoleOption[] | undefined; labelByValue: Map<string, string> }) {
  const normalizedRoles = normalizeRoles(roles);
  if (normalizedRoles.length === 0) {
    return <p className="mt-3 text-sm text-gray-500">No roles assigned.</p>;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {normalizedRoles.map((role) => (
        <span key={role} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
          {labelByValue.get(role) ?? role}
        </span>
      ))}
    </div>
  );
}

function RoleCheckboxes({ roles, selected, onToggle }: { roles: RoleOption[]; selected: string[]; onToggle: (role: string) => void }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Roles</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {roles.map((role) => {
          const value = getRoleValue(role);
          return (
            <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm hover:bg-gray-50">
              <input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
              <span className="font-medium text-gray-800">{getRoleLabel(role)}</span>
            </label>
          );
        })}
        {roles.length === 0 && <EmptyState label="No roles available." />}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="space-y-1 text-sm font-medium text-gray-700">
      {label}
      <input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-normal focus:border-transparent focus:ring-2 focus:ring-blue-500" />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 text-sm font-medium text-gray-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-normal focus:border-transparent focus:ring-2 focus:ring-blue-500">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormActions({ error, isSaving, onCancel }: { error: string | null; isSaving: boolean; onCancel: () => void }) {
  return (
    <>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
        <button type="button" onClick={onCancel} disabled={isSaving} className="rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 disabled:opacity-60">
          Cancel
        </button>
        <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60">
          {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>
    </>
  );
}
