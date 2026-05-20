import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Edit3, LoaderCircle, Plus, Save, Search, X } from "lucide-react";
import {
  createCandidate,
  listCandidates,
  updateCandidate,
  type ApiId,
  type Candidate,
  type CreateCandidateRequest,
  type UpdateCandidateRequest,
} from "../../api";
import { isRequestError, queryClient } from "../../request";

interface CandidateFormState {
  name: string;
  email: string;
  phone: string;
  gender: string;
  source: string;
  location: string;
  school: string;
  major: string;
  highestEducation: string;
  currentCompany: string;
  currentPosition: string;
  yearsOfExperience: string;
}

const defaultForm: CandidateFormState = {
  name: "",
  email: "",
  phone: "",
  gender: "",
  source: "manual",
  location: "",
  school: "",
  major: "",
  highestEducation: "",
  currentCompany: "",
  currentPosition: "",
  yearsOfExperience: "",
};

function getErrorMessage(error: unknown, fallback: string): string {
  return isRequestError(error) ? error.message : fallback;
}

function toOptionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function idToString(id: ApiId | undefined): string {
  return id === undefined ? "" : String(id);
}

function compact(value: string): string | undefined {
  return value.trim() || undefined;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export default function CandidatesPage() {
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [source, setSource] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [form, setForm] = useState<CandidateFormState>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);

  const candidatesQuery = useQuery({
    queryKey: ["candidates", { keyword, source }],
    queryFn: () =>
      listCandidates({
        page: 1,
        pageSize: 50,
        keyword: keyword || undefined,
        source: source || undefined,
      }),
  });

  const createCandidateMutation = useMutation({
    mutationFn: createCandidate,
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to create candidate.")),
  });

  const updateCandidateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: ApiId; payload: UpdateCandidateRequest }) => updateCandidate(id, payload),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to update candidate.")),
  });

  const isSaving = createCandidateMutation.isPending || updateCandidateMutation.isPending;

  const closeModal = () => {
    setModalOpen(false);
    setSelectedCandidate(null);
    setForm(defaultForm);
    setFormError(null);
  };

  const openCreate = () => {
    setSelectedCandidate(null);
    setForm(defaultForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setForm({
      name: candidate.name,
      email: candidate.email ?? "",
      phone: candidate.phone ?? "",
      gender: candidate.gender ?? "",
      source: candidate.source ?? "",
      location: candidate.location ?? "",
      school: candidate.school ?? "",
      major: candidate.major ?? "",
      highestEducation: candidate.highestEducation ?? "",
      currentCompany: candidate.currentCompany ?? "",
      currentPosition: candidate.currentPosition ?? "",
      yearsOfExperience: idToString(candidate.yearsOfExperience),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const buildPayload = (): CreateCandidateRequest | null => {
    const name = form.name.trim();
    if (!name) {
      setFormError("Candidate name is required.");
      return null;
    }

    return {
      name,
      email: compact(form.email),
      phone: compact(form.phone),
      gender: compact(form.gender),
      source: compact(form.source),
      location: compact(form.location),
      school: compact(form.school),
      major: compact(form.major),
      highestEducation: compact(form.highestEducation),
      currentCompany: compact(form.currentCompany),
      currentPosition: compact(form.currentPosition),
      yearsOfExperience: toOptionalNumber(form.yearsOfExperience),
    };
  };

  const submitCandidate = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const payload = buildPayload();
    if (!payload) {
      return;
    }

    if (selectedCandidate) {
      updateCandidateMutation.mutate({ id: selectedCandidate.id, payload });
      return;
    }

    createCandidateMutation.mutate(payload);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:mb-8">
        <div>
          <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">Candidates</h1>
          <p className="text-sm text-gray-600 md:text-base">Create and maintain candidate profiles.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Create Candidate
        </button>
      </div>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <SearchBox value={keywordInput} placeholder="Search name, email, or phone..." onChange={setKeywordInput} onSubmit={() => setKeyword(keywordInput.trim())} />
          <input
            type="text"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Source"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
          <button type="button" onClick={() => setKeyword(keywordInput.trim())} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
            Search
          </button>
        </div>
      </section>

      <QueryState loading={candidatesQuery.isLoading} error={candidatesQuery.error} fallback="Failed to load candidates." />
      {!candidatesQuery.isLoading && !candidatesQuery.isError && (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3 text-sm text-gray-500">
            Total {candidatesQuery.data?.total ?? 0} candidates
          </div>
          <div className="divide-y divide-gray-200">
            {(candidatesQuery.data?.items ?? []).map((candidate) => (
              <div key={String(candidate.id)} className="p-4 transition-colors hover:bg-gray-50">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                      {initials(candidate.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-gray-900">{candidate.name}</h3>
                        {candidate.source && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">{candidate.source}</span>}
                      </div>
                      <div className="grid gap-2 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-4">
                        <span>Email: {candidate.email || "-"}</span>
                        <span>Phone: {candidate.phone || "-"}</span>
                        <span>Location: {candidate.location || "-"}</span>
                        <span>Experience: {candidate.yearsOfExperience ?? "-"} years</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">
                        {[candidate.currentPosition, candidate.currentCompany].filter(Boolean).join(" · ") || [candidate.school, candidate.major].filter(Boolean).join(" · ") || "No career or education info."}
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={() => openEdit(candidate)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </button>
                </div>
              </div>
            ))}
            {(candidatesQuery.data?.items ?? []).length === 0 && <EmptyState label="No candidates found." />}
          </div>
        </section>
      )}

      {modalOpen && (
        <Modal title={selectedCandidate ? "Edit Candidate" : "Create Candidate"} onClose={closeModal}>
          <form onSubmit={submitCandidate} className="space-y-5 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
              <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
              <Field label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
              <Field label="Gender" value={form.gender} onChange={(value) => setForm({ ...form, gender: value })} />
              <Field label="Source" value={form.source} onChange={(value) => setForm({ ...form, source: value })} />
              <Field label="Location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} />
              <Field label="School" value={form.school} onChange={(value) => setForm({ ...form, school: value })} />
              <Field label="Major" value={form.major} onChange={(value) => setForm({ ...form, major: value })} />
              <Field label="Highest Education" value={form.highestEducation} onChange={(value) => setForm({ ...form, highestEducation: value })} />
              <Field label="Years of Experience" type="number" value={form.yearsOfExperience} onChange={(value) => setForm({ ...form, yearsOfExperience: value })} />
              <Field label="Current Company" value={form.currentCompany} onChange={(value) => setForm({ ...form, currentCompany: value })} />
              <Field label="Current Position" value={form.currentPosition} onChange={(value) => setForm({ ...form, currentPosition: value })} />
            </div>
            <FormActions error={formError} isSaving={isSaving} onCancel={closeModal} />
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white shadow-xl">
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

function Field({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="space-y-1 text-sm font-medium text-gray-700">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 font-normal focus:border-transparent focus:ring-2 focus:ring-blue-500"
      />
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
