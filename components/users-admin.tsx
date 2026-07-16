"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ActionSelect } from "@/components/action-select";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { roleLabels } from "@/lib/permissions";
import { generateId } from "@/lib/id";
import {
  roles,
  userStorageKey,
  type AssistanceCompany,
  type Doctor,
  type ManagedUser,
  type Role
} from "@/lib/types";

type UsersAdminProps = {
  initialUsers: ManagedUser[];
  doctors: Doctor[];
  assistanceCompanies: AssistanceCompany[];
  canEdit: boolean;
};

type UserForm = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  role: Role;
  administratorPrivileges: boolean;
  status: ManagedUser["status"];
  doctorId: string;
  assistanceCompanyId: string;
};

const emptyForm: UserForm = {
  name: "",
  email: "",
  phone: "",
  username: "",
  password: "",
  role: "staff",
  administratorPrivileges: false,
  status: "active",
  doctorId: "",
  assistanceCompanyId: ""
};

function userToForm(user: ManagedUser): UserForm {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    username: user.username,
    password: user.password,
    role: user.role,
    administratorPrivileges: Boolean(user.administratorPrivileges),
    status: user.status,
    doctorId: user.doctorId ?? "",
    assistanceCompanyId: user.assistanceCompanyId ?? ""
  };
}

export function UsersAdmin({ assistanceCompanies, canEdit, doctors, initialUsers }: UsersAdminProps) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedUsers = window.localStorage.getItem(userStorageKey);
      if (storedUsers) {
        const parsed = JSON.parse(storedUsers);
        if (Array.isArray(parsed)) {
          setUsers(parsed as ManagedUser[]);
        }
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(userStorageKey, JSON.stringify(users));
    }
  }, [hydrated, users]);

  const filteredUsers = useMemo(() => {
    const search = query.trim().toLowerCase();

    return users.filter((user) => {
      const roleMatches = roleFilter === "all" || user.role === roleFilter;
      const searchMatches =
        !search ||
        [user.name, user.email, user.phone, user.username, roleLabels[user.role]]
          .join(" ")
          .toLowerCase()
          .includes(search);

      return roleMatches && searchMatches;
    });
  }, [query, roleFilter, users]);

  const activeUsers = users.filter((user) => user.status === "active").length;
  const inactiveUsers = users.length - activeUsers;
  const doctorLinkedUsers = users.filter((user) => Boolean(user.doctorId)).length;
  const assistanceCompanyUsers = users.filter((user) => user.role === "assistance_company").length;
  const editing = Boolean(form.id);

  function resetForm() {
    setForm(emptyForm);
    setFormOpen(false);
    setError("");
  }

  function openAddForm() {
    if (!canEdit) {
      return;
    }

    setForm(emptyForm);
    setError("");
    setFormOpen(true);
  }

  function editUser(user: ManagedUser) {
    if (!canEdit) {
      return;
    }

    setForm(userToForm(user));
    setError("");
    setFormOpen(true);
  }

  function saveUser() {
    if (!canEdit) {
      return;
    }

    if (!form.name.trim() || !form.email.trim() || !form.username.trim() || !form.password.trim()) {
      setError("Name, email, username, and password are required.");
      return;
    }

    if (form.role === "doctor" && !form.doctorId) {
      setError("Doctor users must be linked to a doctor profile.");
      return;
    }

    if (form.role === "assistance_company" && !form.assistanceCompanyId) {
      setError("Assistance Company users must be linked to an assistance company.");
      return;
    }

    const assistanceCompany = assistanceCompanies.find(
      (company) => company.id === form.assistanceCompanyId
    );
    const nextUser: ManagedUser = {
      id: form.id ?? generateId(),
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      username: form.username.trim(),
      password: form.password,
      role: form.role,
      administratorPrivileges:
        form.role === "administrator" || (form.role === "director" && form.administratorPrivileges),
      status: form.status,
      doctorId: form.role === "doctor" ? form.doctorId : undefined,
      assistanceCompanyId:
        form.role === "assistance_company" ? form.assistanceCompanyId : undefined,
      assistanceCompany:
        form.role === "assistance_company" ? assistanceCompany?.name : undefined
    };

    setUsers((current) =>
      form.id
        ? current.map((user) => (user.id === form.id ? nextUser : user))
        : [nextUser, ...current]
    );
    resetForm();
  }

  function toggleUserStatus(userId: string) {
    if (!canEdit) {
      return;
    }

    setUsers((current) =>
      current.map((user) =>
        user.id === userId
          ? { ...user, status: user.status === "active" ? "inactive" : "active" }
          : user
      )
    );
  }

  function linkedProfile(user: ManagedUser) {
    if (user.role === "doctor") {
      return doctors.find((doctor) => doctor.id === user.doctorId)?.name ?? "Unlinked doctor";
    }

    if (user.role === "assistance_company") {
      return user.assistanceCompany ?? "Unlinked assistance company";
    }

    return "-";
  }

  function updateRole(role: Role) {
    setForm((current) => ({
      ...current,
      role,
      administratorPrivileges:
        role === "administrator"
          ? true
          : role === "director"
            ? current.administratorPrivileges
            : false,
      doctorId: role === "doctor" ? current.doctorId : "",
      assistanceCompanyId: role === "assistance_company" ? current.assistanceCompanyId : ""
    }));
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active Users" value={String(activeUsers)} tone="primary" />
        <KpiCard label="Inactive Users" value={String(inactiveUsers)} />
        <KpiCard label="Linked Doctor Users" value={String(doctorLinkedUsers)} tone="success" />
        <KpiCard
          label="Assistance Company Users"
          value={String(assistanceCompanyUsers)}
          tone="info"
        />
      </div>

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#efefef] p-4 lg:flex-row lg:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="field min-h-12 lg:max-w-sm"
            placeholder="Search users"
          />
          <select
            aria-label="Filter users by role"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as "all" | Role)}
            className="field min-h-12 lg:max-w-xs"
          >
            <option value="all">All roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
          {canEdit ? (
            <button
              type="button"
              onClick={openAddForm}
              className={buttonClass("primary", "min-h-12 lg:ml-auto")}
            >
              Add User
            </button>
          ) : null}
        </div>

        <div className={tableStyles.wrapper}>
          <table className="min-w-[900px] divide-y divide-[#efefef] text-sm">
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Name</th>
                <th className={tableStyles.headerCell}>Username</th>
                <th className={tableStyles.headerCell}>Role</th>
                <th className={tableStyles.headerCell}>Administrator Privileges</th>
                <th className={tableStyles.headerCell}>Linked Profile</th>
                <th className={tableStyles.headerCell}>Status</th>
                {canEdit ? <th className={tableStyles.actionHeaderCell}>Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {filteredUsers.map((user) => (
                <tr key={user.id} className={tableStyles.row}>
                  <td className={tableStyles.strongCell}>
                    <p>{user.name}</p>
                    <p className="text-xs font-normal text-[#46484a]">{user.email}</p>
                    {user.phone ? (
                      <p className="text-xs font-normal text-[#46484a]">{user.phone}</p>
                    ) : null}
                  </td>
                  <td className={tableStyles.cell}>{user.username}</td>
                  <td className={tableStyles.cell}>{roleLabels[user.role]}</td>
                  <td className={tableStyles.cell}>
                    {user.role === "administrator" || user.administratorPrivileges ? (
                      <StatusPill tone="green">Enabled</StatusPill>
                    ) : (
                      <span className="text-[#46484a]">Disabled</span>
                    )}
                  </td>
                  <td className={tableStyles.cell}>{linkedProfile(user)}</td>
                  <td className={tableStyles.cell}>
                    <StatusPill tone={user.status === "active" ? "green" : "slate"}>
                      {user.status === "active" ? "Active" : "Inactive"}
                    </StatusPill>
                  </td>
                  {canEdit ? (
                    <td className={tableStyles.actionCell}>
                      <ActionSelect
                        ariaLabel={`Actions for ${user.name}`}
                        actions={[
                          {
                            value: "edit",
                            label: "Edit",
                            onSelect: () => editUser(user)
                          },
                          {
                            value: "toggle",
                            label: user.status === "active" ? "Deactivate" : "Activate",
                            onSelect: () => toggleUserStatus(user.id)
                          }
                        ]}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
              {!filteredUsers.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={canEdit ? 7 : 6}>
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1726]/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-form-title"
        >
          <section className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#efefef] px-5 py-4">
              <h2 id="user-form-title" className="font-semibold text-[#224770]">
                {editing ? "Edit User" : "Add User"}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="focus-ring rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                aria-label="Close user form"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="user-name">
                    Name
                  </label>
                  <input
                    id="user-name"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className="field mt-2 min-h-12"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="user-email">
                    Email
                  </label>
                  <input
                    id="user-email"
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                    className="field mt-2 min-h-12"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="user-phone">
                    Phone
                  </label>
                  <input
                    id="user-phone"
                    value={form.phone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, phone: event.target.value }))
                    }
                    className="field mt-2 min-h-12"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="user-username">
                    Username
                  </label>
                  <input
                    id="user-username"
                    value={form.username}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, username: event.target.value }))
                    }
                    className="field mt-2 min-h-12"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="user-password">
                    Password
                  </label>
                  <input
                    id="user-password"
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, password: event.target.value }))
                    }
                    className="field mt-2 min-h-12"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="user-role">
                    Role
                  </label>
                  <select
                    id="user-role"
                    value={form.role}
                    onChange={(event) => updateRole(event.target.value as Role)}
                    className="field mt-2 min-h-12"
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="user-status">
                    Status
                  </label>
                  <select
                    id="user-status"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as ManagedUser["status"]
                      }))
                    }
                    className="field mt-2 min-h-12"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[#efefef] bg-[#f7f9fb] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.role === "administrator" || form.administratorPrivileges}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        administratorPrivileges: event.target.checked
                      }))
                    }
                    disabled={form.role !== "director"}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#224770]">
                      Administrator Privileges
                    </span>
                    <span className="block text-xs text-[#46484a]">
                      Company Directors can optionally receive full Administrator access.
                    </span>
                  </span>
                </label>

                {form.role === "doctor" ? (
                  <div>
                    <label className="label" htmlFor="linked-doctor">
                      Link Doctor
                    </label>
                    <select
                      id="linked-doctor"
                      value={form.doctorId}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, doctorId: event.target.value }))
                      }
                      className="field mt-2 min-h-12"
                    >
                      <option value="">Select doctor</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {form.role === "assistance_company" ? (
                  <div>
                    <label className="label" htmlFor="linked-company">
                      Link Assistance Company
                    </label>
                    <select
                      id="linked-company"
                      value={form.assistanceCompanyId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          assistanceCompanyId: event.target.value
                        }))
                      }
                      className="field mt-2 min-h-12"
                    >
                      <option value="">Select assistance company</option>
                      {assistanceCompanies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#efefef] px-5 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={resetForm} className={buttonClass("secondary")}>
                Cancel
              </button>
              <button type="button" onClick={saveUser} className={buttonClass("primary")}>
                {editing ? "Update User" : "Save User"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
