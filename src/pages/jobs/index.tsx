import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Edit3,
  LoaderCircle,
  Plus,
  Save,
  Search,
  Tag,
  Tags,
  UserPlus,
  X,
} from "lucide-react";
import {
  assignJobMember,
  bindJobTags,
  createJob,
  createJobCategory,
  createTag,
  createTagGroup,
  listJobCategories,
  listJobs,
  listTagGroups,
  listTags,
  updateJob,
  updateJobCategory,
  updateTag,
  type ApiId,
  type CreateJobCategoryRequest,
  type CreateJobRequest,
  type CreateTagGroupRequest,
  type CreateTagRequest,
  type Job,
  type JobCategory,
  type JobCategoryStatus,
  type JobStatus,
  type Tag as ApiTag,
  type TagStatus,
  type UpdateJobCategoryRequest,
  type UpdateJobRequest,
  type UpdateTagRequest,
} from "../../api";
import { isRequestError, queryClient } from "../../request";

type TabId = "jobs" | "categories" | "tags" | "groups";
type ModalId = "job" | "category" | "tag" | "group" | "bindTags" | "member" | null;

interface JobFormState {
  title: string;
  categoryId: string;
  department: string;
  workLocation: string;
  employmentType: string;
  workType: string;
  educationLevel: string;
  experienceMin: string;
  experienceMax: string;
  salaryMin: string;
  salaryMax: string;
  salaryMonths: string;
  headcount: string;
  ownerUserId: string;
  priority: string;
  status: JobStatus | string;
  description: string;
  responsibilities: string;
  requirements: string;
  bonusPoints: string;
}

interface CategoryFormState {
  name: string;
  description: string;
  parentId: string;
  sortOrder: string;
  status: JobCategoryStatus;
}

interface TagGroupFormState {
  name: string;
  description: string;
  sortOrder: string;
}

interface TagFormState {
  name: string;
  groupId: string;
  color: string;
  status: TagStatus;
}

const tabs: Array<{ id: TabId; label: string; icon: typeof Briefcase }> = [
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "categories", label: "Categories", icon: Tags },
  { id: "tags", label: "Tags", icon: Tag },
  { id: "groups", label: "Tag Groups", icon: Tags },
];

const defaultJobForm: JobFormState = {
  title: "",
  categoryId: "",
  department: "",
  workLocation: "",
  employmentType: "",
  workType: "",
  educationLevel: "",
  experienceMin: "",
  experienceMax: "",
  salaryMin: "",
  salaryMax: "",
  salaryMonths: "",
  headcount: "",
  ownerUserId: "",
  priority: "medium",
  status: "draft",
  description: "",
  responsibilities: "",
  requirements: "",
  bonusPoints: "",
};

const defaultCategoryForm: CategoryFormState = {
  name: "",
  description: "",
  parentId: "",
  sortOrder: "",
  status: "active",
};

const defaultTagGroupForm: TagGroupFormState = {
  name: "",
  description: "",
  sortOrder: "",
};

const defaultTagForm: TagFormState = {
  name: "",
  groupId: "",
  color: "#2563eb",
  status: "active",
};

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

function getErrorMessage(error: unknown, fallback: string): string {
  return isRequestError(error) ? error.message : fallback;
}

function getStatusStyle(status: string): string {
  if (status === "active" || status === "published") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (status === "disabled" || status === "closed") {
    return "bg-slate-100 text-slate-700 ring-slate-200";
  }
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function getPriorityStyle(priority?: string): string {
  if (priority === "high" || priority === "urgent") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  if (priority === "low") {
    return "bg-slate-100 text-slate-700 ring-slate-200";
  }
  return "bg-sky-50 text-sky-700 ring-sky-200";
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed  inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
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

export default function JobsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("jobs");
  const [modal, setModal] = useState<ModalId>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<JobCategory | null>(null);
  const [selectedTag, setSelectedTag] = useState<ApiTag | null>(null);
  const [jobForm, setJobForm] = useState<JobFormState>(defaultJobForm);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(defaultCategoryForm);
  const [tagGroupForm, setTagGroupForm] = useState<TagGroupFormState>(defaultTagGroupForm);
  const [tagForm, setTagForm] = useState<TagFormState>(defaultTagForm);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("reviewer");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());

  const [jobKeywordInput, setJobKeywordInput] = useState("");
  const [jobKeyword, setJobKeyword] = useState("");
  const [jobStatus, setJobStatus] = useState("");
  const [jobCategoryId, setJobCategoryId] = useState("");
  const [categoryKeywordInput, setCategoryKeywordInput] = useState("");
  const [categoryKeyword, setCategoryKeyword] = useState("");
  const [categoryStatus, setCategoryStatus] = useState("");
  const [tagKeywordInput, setTagKeywordInput] = useState("");
  const [tagKeyword, setTagKeyword] = useState("");
  const [tagStatus, setTagStatus] = useState("");
  const [tagGroupId, setTagGroupId] = useState("");
  const [groupKeywordInput, setGroupKeywordInput] = useState("");
  const [groupKeyword, setGroupKeyword] = useState("");
  const [groupStatus, setGroupStatus] = useState("");

  const jobsQuery = useQuery({
    queryKey: ["jobs", { keyword: jobKeyword, status: jobStatus, categoryId: jobCategoryId }],
    queryFn: () =>
      listJobs({
        page: 1,
        pageSize: 50,
        keyword: jobKeyword || undefined,
        status: jobStatus || undefined,
        categoryId: toOptionalNumber(jobCategoryId),
      }),
  });

  const categoriesQuery = useQuery({
    queryKey: ["job-categories", { keyword: categoryKeyword, status: categoryStatus }],
    queryFn: () =>
      listJobCategories({
        page: 1,
        pageSize: 50,
        keyword: categoryKeyword || undefined,
        status: (categoryStatus || undefined) as JobCategoryStatus | undefined,
      }),
  });

  const categoryOptionsQuery = useQuery({
    queryKey: ["job-categories", "options"],
    queryFn: () => listJobCategories({ page: 1, pageSize: 200, status: "active" }),
  });

  const tagGroupsQuery = useQuery({
    queryKey: ["tag-groups", { keyword: groupKeyword, status: groupStatus }],
    queryFn: () =>
      listTagGroups({
        page: 1,
        pageSize: 50,
        keyword: groupKeyword || undefined,
        status: groupStatus || undefined,
      }),
  });

  const tagGroupOptionsQuery = useQuery({
    queryKey: ["tag-groups", "options"],
    queryFn: () => listTagGroups({ page: 1, pageSize: 200, status: "active" }),
  });

  const tagsQuery = useQuery({
    queryKey: ["tags", { keyword: tagKeyword, status: tagStatus, groupId: tagGroupId }],
    queryFn: () =>
      listTags({
        page: 1,
        pageSize: 50,
        keyword: tagKeyword || undefined,
        status: tagStatus || undefined,
        groupId: toOptionalNumber(tagGroupId),
      }),
  });

  const tagOptionsQuery = useQuery({
    queryKey: ["tags", "options"],
    queryFn: () => listTags({ page: 1, pageSize: 200, status: "active" }),
  });

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categoryOptionsQuery.data?.items.forEach((category) => map.set(String(category.id), category.name));
    return map;
  }, [categoryOptionsQuery.data]);

  const tagGroupNameById = useMemo(() => {
    const map = new Map<string, string>();
    tagGroupOptionsQuery.data?.items.forEach((group) => map.set(String(group.id), group.name));
    return map;
  }, [tagGroupOptionsQuery.data]);

  const createJobMutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to create job.")),
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, payload }: { id: ApiId; payload: UpdateJobRequest }) => updateJob(id, payload),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to update job.")),
  });

  const createCategoryMutation = useMutation({
    mutationFn: createJobCategory,
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["job-categories"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to create category.")),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, payload }: { id: ApiId; payload: UpdateJobCategoryRequest }) => updateJobCategory(id, payload),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["job-categories"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to update category.")),
  });

  const createTagGroupMutation = useMutation({
    mutationFn: createTagGroup,
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["tag-groups"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to create tag group.")),
  });

  const createTagMutation = useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to create tag.")),
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, payload }: { id: ApiId; payload: UpdateTagRequest }) => updateTag(id, payload),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to update tag.")),
  });

  const bindTagsMutation = useMutation({
    mutationFn: ({ id, payload }: { id: ApiId; payload: { tagIds: number[] } }) => bindJobTags(id, payload),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to bind tags.")),
  });

  const assignMemberMutation = useMutation({
    mutationFn: ({ id, userId, memberRole }: { id: ApiId; userId: number; memberRole: string }) =>
      assignJobMember(id, { userId, memberRole }),
    onSuccess: () => closeModal(),
    onError: (error) => setFormError(getErrorMessage(error, "Failed to assign member.")),
  });

  const closeModal = () => {
    setModal(null);
    setFormError(null);
    setSelectedJob(null);
    setSelectedCategory(null);
    setSelectedTag(null);
    setJobForm(defaultJobForm);
    setCategoryForm(defaultCategoryForm);
    setTagGroupForm(defaultTagGroupForm);
    setTagForm(defaultTagForm);
    setMemberUserId("");
    setMemberRole("reviewer");
    setSelectedTagIds(new Set());
  };

  const openCreateJob = () => {
    setJobForm(defaultJobForm);
    setSelectedJob(null);
    setFormError(null);
    setModal("job");
  };

  const openEditJob = (job: Job) => {
    setSelectedJob(job);
    setJobForm({
      title: job.title,
      categoryId: idToString(job.categoryId),
      department: job.department ?? "",
      workLocation: job.workLocation ?? "",
      employmentType: job.employmentType ?? "",
      workType: job.workType ?? "",
      educationLevel: job.educationLevel ?? "",
      experienceMin: idToString(job.experienceMin),
      experienceMax: idToString(job.experienceMax),
      salaryMin: idToString(job.salaryMin),
      salaryMax: idToString(job.salaryMax),
      salaryMonths: idToString(job.salaryMonths),
      headcount: idToString(job.headcount),
      ownerUserId: idToString(job.ownerUserId),
      priority: job.priority ?? "medium",
      status: job.status || "draft",
      description: job.description ?? "",
      responsibilities: job.responsibilities ?? "",
      requirements: job.requirements ?? "",
      bonusPoints: job.bonusPoints ?? "",
    });
    setFormError(null);
    setModal("job");
  };

  const openCreateCategory = () => {
    setCategoryForm(defaultCategoryForm);
    setSelectedCategory(null);
    setFormError(null);
    setModal("category");
  };

  const openEditCategory = (category: JobCategory) => {
    setSelectedCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description ?? "",
      parentId: idToString(category.parentId),
      sortOrder: idToString(category.sortOrder),
      status: category.status === "disabled" ? "disabled" : "active",
    });
    setFormError(null);
    setModal("category");
  };

  const openCreateTag = () => {
    setTagForm(defaultTagForm);
    setSelectedTag(null);
    setFormError(null);
    setModal("tag");
  };

  const openEditTag = (tagItem: ApiTag) => {
    setSelectedTag(tagItem);
    setTagForm({
      name: tagItem.name,
      groupId: idToString(tagItem.groupId),
      color: tagItem.color ?? "#2563eb",
      status: tagItem.status === "disabled" ? "disabled" : "active",
    });
    setFormError(null);
    setModal("tag");
  };

  const openBindTags = (job: Job) => {
    setSelectedJob(job);
    setSelectedTagIds(new Set());
    setFormError(null);
    setModal("bindTags");
  };

  const openAssignMember = (job: Job) => {
    setSelectedJob(job);
    setMemberUserId("");
    setMemberRole("reviewer");
    setFormError(null);
    setModal("member");
  };

  const submitJob = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const title = jobForm.title.trim();
    if (!title) {
      setFormError("Job title is required.");
      return;
    }

    const basePayload: CreateJobRequest = {
      title,
      categoryId: toOptionalNumber(jobForm.categoryId),
      department: jobForm.department.trim() || undefined,
      workLocation: jobForm.workLocation.trim() || undefined,
      employmentType: jobForm.employmentType.trim() || undefined,
      workType: jobForm.workType.trim() || undefined,
      educationLevel: jobForm.educationLevel.trim() || undefined,
      experienceMin: toOptionalNumber(jobForm.experienceMin),
      experienceMax: toOptionalNumber(jobForm.experienceMax),
      salaryMin: toOptionalNumber(jobForm.salaryMin),
      salaryMax: toOptionalNumber(jobForm.salaryMax),
      salaryMonths: toOptionalNumber(jobForm.salaryMonths),
      headcount: toOptionalNumber(jobForm.headcount),
      ownerUserId: toOptionalNumber(jobForm.ownerUserId),
      priority: jobForm.priority.trim() || undefined,
      status: jobForm.status,
      description: jobForm.description.trim() || undefined,
      responsibilities: jobForm.responsibilities.trim() || undefined,
      requirements: jobForm.requirements.trim() || undefined,
      bonusPoints: jobForm.bonusPoints.trim() || undefined,
    };

    if (selectedJob) {
      updateJobMutation.mutate({
        id: selectedJob.id,
        payload: {
          ...basePayload,
          priority: basePayload.priority || "medium",
          status: basePayload.status || "draft",
        },
      });
      return;
    }

    createJobMutation.mutate(basePayload);
  };

  const submitCategory = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const name = categoryForm.name.trim();
    if (!name) {
      setFormError("Category name is required.");
      return;
    }

    const payload: CreateJobCategoryRequest = {
      name,
      description: categoryForm.description.trim() || undefined,
      parentId: toOptionalNumber(categoryForm.parentId),
      sortOrder: toOptionalNumber(categoryForm.sortOrder),
      status: categoryForm.status,
    };

    if (selectedCategory) {
      updateCategoryMutation.mutate({
        id: selectedCategory.id,
        payload: {
          ...payload,
          status: categoryForm.status,
        },
      });
      return;
    }

    createCategoryMutation.mutate(payload);
  };

  const submitTagGroup = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const name = tagGroupForm.name.trim();
    if (!name) {
      setFormError("Tag group name is required.");
      return;
    }

    const payload: CreateTagGroupRequest = {
      name,
      description: tagGroupForm.description.trim() || undefined,
      sortOrder: toOptionalNumber(tagGroupForm.sortOrder),
    };
    createTagGroupMutation.mutate(payload);
  };

  const submitTag = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const name = tagForm.name.trim();
    if (!name) {
      setFormError("Tag name is required.");
      return;
    }

    const payload: CreateTagRequest = {
      name,
      groupId: toOptionalNumber(tagForm.groupId),
      color: tagForm.color.trim() || undefined,
    };

    if (selectedTag) {
      updateTagMutation.mutate({
        id: selectedTag.id,
        payload: {
          ...payload,
          status: tagForm.status,
        },
      });
      return;
    }

    createTagMutation.mutate(payload);
  };

  const submitBindTags = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedJob) {
      return;
    }
    bindTagsMutation.mutate({ id: selectedJob.id, payload: { tagIds: Array.from(selectedTagIds) } });
  };

  const submitMember = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!selectedJob) {
      return;
    }
    const userId = toOptionalNumber(memberUserId);
    if (!userId) {
      setFormError("User ID is required.");
      return;
    }
    if (!memberRole.trim()) {
      setFormError("Member role is required.");
      return;
    }
    assignMemberMutation.mutate({ id: selectedJob.id, userId, memberRole: memberRole.trim() });
  };

  const toggleTagSelection = (tagId: number) => {
    setSelectedTagIds((current) => {
      const next = new Set(current);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const isSaving =
    createJobMutation.isPending ||
    updateJobMutation.isPending ||
    createCategoryMutation.isPending ||
    updateCategoryMutation.isPending ||
    createTagGroupMutation.isPending ||
    createTagMutation.isPending ||
    updateTagMutation.isPending ||
    bindTagsMutation.isPending ||
    assignMemberMutation.isPending;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:mb-8">
        <div>
          <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">Job Management</h1>
          <p className="text-sm text-gray-600 md:text-base">Manage jobs, categories, and matching tags.</p>
        </div>
        <button
          type="button"
          onClick={activeTab === "jobs" ? openCreateJob : activeTab === "categories" ? openCreateCategory : activeTab === "tags" ? openCreateTag : () => setModal("group")}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white shadow-sm transition-colors hover:bg-blue-700 md:text-base"
        >
          <Plus className="h-5 w-5" />
          {activeTab === "jobs" ? "Create Job" : activeTab === "categories" ? "Create Category" : activeTab === "tags" ? "Create Tag" : "Create Group"}
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "jobs" && (
        <section className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
              <SearchBox
                value={jobKeywordInput}
                placeholder="Search job title..."
                onChange={setJobKeywordInput}
                onSubmit={() => setJobKeyword(jobKeywordInput.trim())}
              />
              <select value={jobCategoryId} onChange={(event) => setJobCategoryId(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500">
                <option value="">All Categories</option>
                {categoryOptionsQuery.data?.items.map((category) => (
                  <option key={String(category.id)} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select value={jobStatus} onChange={(event) => setJobStatus(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500">
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
              <button type="button" onClick={() => setJobKeyword(jobKeywordInput.trim())} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
                Search
              </button>
            </div>
          </div>

          <QueryState loading={jobsQuery.isLoading} error={jobsQuery.error} fallback="Failed to load jobs." />
          {!jobsQuery.isLoading && !jobsQuery.isError && (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3 text-sm text-gray-500">
                Total {jobsQuery.data?.total ?? 0} jobs
              </div>
              <div className="divide-y divide-gray-200">
                {(jobsQuery.data?.items ?? []).map((job) => (
                  <div key={String(job.id)} className="p-4 transition-colors hover:bg-gray-50">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-semibold text-gray-900">{job.title}</h3>
                          <StatusBadge value={job.status} />
                          {job.priority && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${getPriorityStyle(job.priority)}`}>{job.priority}</span>}
                        </div>
                        <div className="grid gap-2 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-4">
                          <span>Category: {job.categoryName ?? categoryNameById.get(String(job.categoryId)) ?? "-"}</span>
                          <span>Department: {job.department || "-"}</span>
                          <span>Location: {job.workLocation || "-"}</span>
                          <span>Headcount: {job.headcount ?? "-"}</span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm text-gray-600">{job.description || job.requirements || "No description."}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openEditJob(job)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </button>
                        <button type="button" onClick={() => openBindTags(job)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                          <Tag className="h-4 w-4" />
                          Tags
                        </button>
                        <button type="button" onClick={() => openAssignMember(job)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                          <UserPlus className="h-4 w-4" />
                          Member
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {(jobsQuery.data?.items ?? []).length === 0 && <EmptyState label="No jobs found." />}
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === "categories" && (
        <section className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
              <SearchBox value={categoryKeywordInput} placeholder="Search category..." onChange={setCategoryKeywordInput} onSubmit={() => setCategoryKeyword(categoryKeywordInput.trim())} />
              <select value={categoryStatus} onChange={(event) => setCategoryStatus(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
              <button type="button" onClick={() => setCategoryKeyword(categoryKeywordInput.trim())} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
                Search
              </button>
            </div>
          </div>
          <QueryState loading={categoriesQuery.isLoading} error={categoriesQuery.error} fallback="Failed to load categories." />
          {!categoriesQuery.isLoading && !categoriesQuery.isError && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {(categoriesQuery.data?.items ?? []).map((category) => (
                <div key={String(category.id)} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-gray-900">{category.name}</h3>
                      <p className="mt-1 text-sm text-gray-500">ID: {String(category.id)}</p>
                    </div>
                    <StatusBadge value={category.status} />
                  </div>
                  <p className="min-h-10 text-sm text-gray-600">{category.description || "No description."}</p>
                  <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                    <span>Sort: {category.sortOrder ?? "-"}</span>
                    <button type="button" onClick={() => openEditCategory(category)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
              {(categoriesQuery.data?.items ?? []).length === 0 && <EmptyState label="No categories found." />}
            </div>
          )}
        </section>
      )}

      {activeTab === "tags" && (
        <section className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
              <SearchBox value={tagKeywordInput} placeholder="Search tag..." onChange={setTagKeywordInput} onSubmit={() => setTagKeyword(tagKeywordInput.trim())} />
              <select value={tagGroupId} onChange={(event) => setTagGroupId(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500">
                <option value="">All Groups</option>
                {tagGroupOptionsQuery.data?.items.map((group) => (
                  <option key={String(group.id)} value={String(group.id)}>
                    {group.name}
                  </option>
                ))}
              </select>
              <select value={tagStatus} onChange={(event) => setTagStatus(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
              <button type="button" onClick={() => setTagKeyword(tagKeywordInput.trim())} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
                Search
              </button>
            </div>
          </div>
          <QueryState loading={tagsQuery.isLoading} error={tagsQuery.error} fallback="Failed to load tags." />
          {!tagsQuery.isLoading && !tagsQuery.isError && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(tagsQuery.data?.items ?? []).map((tagItem) => (
                <div key={String(tagItem.id)} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-4 w-4 rounded-full ring-1 ring-gray-200" style={{ backgroundColor: tagItem.color || "#2563eb" }} />
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-gray-900">{tagItem.name}</h3>
                        <p className="mt-1 text-sm text-gray-500">{tagItem.groupName ?? tagGroupNameById.get(String(tagItem.groupId)) ?? "No group"}</p>
                      </div>
                    </div>
                    <StatusBadge value={tagItem.status} />
                  </div>
                  <button type="button" onClick={() => openEditTag(tagItem)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </button>
                </div>
              ))}
              {(tagsQuery.data?.items ?? []).length === 0 && <EmptyState label="No tags found." />}
            </div>
          )}
        </section>
      )}

      {activeTab === "groups" && (
        <section className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
              <SearchBox value={groupKeywordInput} placeholder="Search tag group..." onChange={setGroupKeywordInput} onSubmit={() => setGroupKeyword(groupKeywordInput.trim())} />
              <select value={groupStatus} onChange={(event) => setGroupStatus(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
              <button type="button" onClick={() => setGroupKeyword(groupKeywordInput.trim())} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
                Search
              </button>
            </div>
          </div>
          <QueryState loading={tagGroupsQuery.isLoading} error={tagGroupsQuery.error} fallback="Failed to load tag groups." />
          {!tagGroupsQuery.isLoading && !tagGroupsQuery.isError && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {(tagGroupsQuery.data?.items ?? []).map((group) => (
                <div key={String(group.id)} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-gray-900">{group.name}</h3>
                      <p className="mt-1 text-sm text-gray-500">Sort: {group.sortOrder ?? "-"}</p>
                    </div>
                    <StatusBadge value={group.status} />
                  </div>
                  <p className="text-sm text-gray-600">{group.description || "No description."}</p>
                </div>
              ))}
              {(tagGroupsQuery.data?.items ?? []).length === 0 && <EmptyState label="No tag groups found." />}
            </div>
          )}
        </section>
      )}

      {modal === "job" && (
        <Modal title={selectedJob ? "Edit Job" : "Create Job"} onClose={closeModal}>
          <form onSubmit={submitJob} className="space-y-5 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Title" value={jobForm.title} onChange={(value) => setJobForm({ ...jobForm, title: value })} required />
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Category
                <select value={jobForm.categoryId} onChange={(event) => setJobForm({ ...jobForm, categoryId: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-normal focus:border-transparent focus:ring-2 focus:ring-blue-500">
                  <option value="">None</option>
                  {categoryOptionsQuery.data?.items.map((category) => (
                    <option key={String(category.id)} value={String(category.id)}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Department" value={jobForm.department} onChange={(value) => setJobForm({ ...jobForm, department: value })} />
              <Field label="Location" value={jobForm.workLocation} onChange={(value) => setJobForm({ ...jobForm, workLocation: value })} />
              <SelectField label="Status" value={jobForm.status} onChange={(value) => setJobForm({ ...jobForm, status: value })} options={["draft", "published", "closed"]} />
              <SelectField label="Priority" value={jobForm.priority} onChange={(value) => setJobForm({ ...jobForm, priority: value })} options={["low", "medium", "high", "urgent"]} />
              <Field label="Employment Type" value={jobForm.employmentType} onChange={(value) => setJobForm({ ...jobForm, employmentType: value })} />
              <Field label="Work Type" value={jobForm.workType} onChange={(value) => setJobForm({ ...jobForm, workType: value })} />
              <Field label="Education" value={jobForm.educationLevel} onChange={(value) => setJobForm({ ...jobForm, educationLevel: value })} />
              <Field label="Owner User ID" type="number" value={jobForm.ownerUserId} onChange={(value) => setJobForm({ ...jobForm, ownerUserId: value })} />
              <Field label="Experience Min" type="number" value={jobForm.experienceMin} onChange={(value) => setJobForm({ ...jobForm, experienceMin: value })} />
              <Field label="Experience Max" type="number" value={jobForm.experienceMax} onChange={(value) => setJobForm({ ...jobForm, experienceMax: value })} />
              <Field label="Salary Min" type="number" value={jobForm.salaryMin} onChange={(value) => setJobForm({ ...jobForm, salaryMin: value })} />
              <Field label="Salary Max" type="number" value={jobForm.salaryMax} onChange={(value) => setJobForm({ ...jobForm, salaryMax: value })} />
              <Field label="Salary Months" type="number" value={jobForm.salaryMonths} onChange={(value) => setJobForm({ ...jobForm, salaryMonths: value })} />
              <Field label="Headcount" type="number" value={jobForm.headcount} onChange={(value) => setJobForm({ ...jobForm, headcount: value })} />
            </div>
            <TextArea label="Description" value={jobForm.description} onChange={(value) => setJobForm({ ...jobForm, description: value })} />
            <TextArea label="Responsibilities" value={jobForm.responsibilities} onChange={(value) => setJobForm({ ...jobForm, responsibilities: value })} />
            <TextArea label="Requirements" value={jobForm.requirements} onChange={(value) => setJobForm({ ...jobForm, requirements: value })} />
            <TextArea label="Bonus Points" value={jobForm.bonusPoints} onChange={(value) => setJobForm({ ...jobForm, bonusPoints: value })} />
            <FormActions error={formError} isSaving={isSaving} onCancel={closeModal} />
          </form>
        </Modal>
      )}

      {modal === "category" && (
        <Modal title={selectedCategory ? "Edit Category" : "Create Category"} onClose={closeModal}>
          <form onSubmit={submitCategory} className="space-y-5 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" value={categoryForm.name} onChange={(value) => setCategoryForm({ ...categoryForm, name: value })} required />
              <SelectField label="Status" value={categoryForm.status} onChange={(value) => setCategoryForm({ ...categoryForm, status: value as JobCategoryStatus })} options={["active", "disabled"]} />
              <Field label="Parent ID" type="number" value={categoryForm.parentId} onChange={(value) => setCategoryForm({ ...categoryForm, parentId: value })} />
              <Field label="Sort Order" type="number" value={categoryForm.sortOrder} onChange={(value) => setCategoryForm({ ...categoryForm, sortOrder: value })} />
            </div>
            <TextArea label="Description" value={categoryForm.description} onChange={(value) => setCategoryForm({ ...categoryForm, description: value })} />
            <FormActions error={formError} isSaving={isSaving} onCancel={closeModal} />
          </form>
        </Modal>
      )}

      {modal === "group" && (
        <Modal title="Create Tag Group" onClose={closeModal}>
          <form onSubmit={submitTagGroup} className="space-y-5 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" value={tagGroupForm.name} onChange={(value) => setTagGroupForm({ ...tagGroupForm, name: value })} required />
              <Field label="Sort Order" type="number" value={tagGroupForm.sortOrder} onChange={(value) => setTagGroupForm({ ...tagGroupForm, sortOrder: value })} />
            </div>
            <TextArea label="Description" value={tagGroupForm.description} onChange={(value) => setTagGroupForm({ ...tagGroupForm, description: value })} />
            <FormActions error={formError} isSaving={isSaving} onCancel={closeModal} />
          </form>
        </Modal>
      )}

      {modal === "tag" && (
        <Modal title={selectedTag ? "Edit Tag" : "Create Tag"} onClose={closeModal}>
          <form onSubmit={submitTag} className="space-y-5 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" value={tagForm.name} onChange={(value) => setTagForm({ ...tagForm, name: value })} required />
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Group
                <select value={tagForm.groupId} onChange={(event) => setTagForm({ ...tagForm, groupId: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-normal focus:border-transparent focus:ring-2 focus:ring-blue-500">
                  <option value="">None</option>
                  {tagGroupOptionsQuery.data?.items.map((group) => (
                    <option key={String(group.id)} value={String(group.id)}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Color" type="color" value={tagForm.color} onChange={(value) => setTagForm({ ...tagForm, color: value })} />
              <SelectField label="Status" value={tagForm.status} onChange={(value) => setTagForm({ ...tagForm, status: value as TagStatus })} options={["active", "disabled"]} />
            </div>
            <FormActions error={formError} isSaving={isSaving} onCancel={closeModal} />
          </form>
        </Modal>
      )}

      {modal === "bindTags" && selectedJob && (
        <Modal title={`Bind Tags: ${selectedJob.title}`} onClose={closeModal}>
          <form onSubmit={submitBindTags} className="space-y-5 p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(tagOptionsQuery.data?.items ?? []).map((tagItem) => {
                const numericId = Number(tagItem.id);
                const disabled = !Number.isFinite(numericId);
                const checked = selectedTagIds.has(numericId);
                return (
                  <label key={String(tagItem.id)} className={`flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm ${disabled ? "opacity-50" : "cursor-pointer hover:bg-gray-50"}`}>
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleTagSelection(numericId)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                    <span className="h-3 w-3 rounded-full ring-1 ring-gray-200" style={{ backgroundColor: tagItem.color || "#2563eb" }} />
                    <span className="font-medium text-gray-800">{tagItem.name}</span>
                    <span className="text-gray-500">{tagItem.groupName ?? tagGroupNameById.get(String(tagItem.groupId)) ?? ""}</span>
                  </label>
                );
              })}
              {(tagOptionsQuery.data?.items ?? []).length === 0 && <EmptyState label="No active tags available." />}
            </div>
            <FormActions error={formError} isSaving={isSaving} onCancel={closeModal} />
          </form>
        </Modal>
      )}

      {modal === "member" && selectedJob && (
        <Modal title={`Assign Member: ${selectedJob.title}`} onClose={closeModal}>
          <form onSubmit={submitMember} className="space-y-5 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="User ID" type="number" value={memberUserId} onChange={setMemberUserId} required />
              <Field label="Member Role" value={memberRole} onChange={setMemberRole} required />
            </div>
            <FormActions error={formError} isSaving={isSaving} onCancel={closeModal} />
          </form>
        </Modal>
      )}
    </div>
  );
}

function SearchBox({
  value,
  placeholder,
  onChange,
  onSubmit,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
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
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
        {getErrorMessage(error, fallback)}
      </div>
    );
  }

  return null;
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">{label}</div>;
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${getStatusStyle(value)}`}>{value}</span>;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
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

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
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

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 text-sm font-medium text-gray-700">
      {label}
      <textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 font-normal focus:border-transparent focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function FormActions({
  error,
  isSaving,
  onCancel,
}: {
  error: string | null;
  isSaving: boolean;
  onCancel: () => void;
}) {
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
