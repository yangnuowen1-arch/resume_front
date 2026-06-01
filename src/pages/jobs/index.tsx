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
  Trash2,
  X,
} from "lucide-react";
import {
  createJob,
  createJobCategory,
  createTag,
  createTagGroup,
  deleteJob,
  getJob,
  listGroupedTags,
  listJobCategories,
  listJobs,
  listTagGroups,
  listTags,
  listUsers,
  updateJob,
  updateJobCategory,
  updateTag,
  updateTagGroup,
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
  type TagGroup,
  type TagGroupStatus,
  type TagStatus,
  type UpdateJobCategoryRequest,
  type UpdateJobRequest,
  type UpdateTagGroupRequest,
  type UpdateTagRequest,
  type User,
} from "../../api";
import { isRequestError, queryClient } from "../../request";

type TabId = "jobs" | "categories" | "tags" | "groups";
type ModalId = "job" | "category" | "tag" | "group" | null;

interface JobFormState {
  title: string;
  categoryId: string;
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
  status: JobCategoryStatus;
}

interface TagGroupFormState {
  name: string;
  description: string;
  status: TagGroupStatus;
}

interface TagFormState {
  name: string;
  groupId: string;
  color: string;
  status: TagStatus;
}

type JobTagSelections = Record<string, string>;

const tabs: Array<{ id: TabId; label: string; icon: typeof Briefcase }> = [
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "categories", label: "Categories", icon: Tags },
  { id: "tags", label: "Tags", icon: Tag },
  { id: "groups", label: "Tag Groups", icon: Tags },
];

const defaultJobForm: JobFormState = {
  title: "",
  categoryId: "",
  salaryMin: "",
  salaryMax: "",
  salaryMonths: "",
  headcount: "",
  ownerUserId: "",
  priority: "normal",
  status: "draft",
  description: "",
  responsibilities: "",
  requirements: "",
  bonusPoints: "",
};

const defaultCategoryForm: CategoryFormState = {
  name: "",
  description: "",
  status: "active",
};

const defaultTagGroupForm: TagGroupFormState = {
  name: "",
  description: "",
  status: "active",
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

function toNullableNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function idToString(id: ApiId | number | null | undefined): string {
  return id === undefined || id === null ? "" : String(id);
}

function toNumericId(id: ApiId | number | null | undefined): number | undefined {
  if (id === undefined || id === null) {
    return undefined;
  }
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getTagId(tagItem: ApiTag): ApiId | undefined {
  return tagItem.id ?? tagItem.tagId;
}

function normalizePriority(priority: string | undefined): string {
  if (!priority || priority === "medium") {
    return "normal";
  }
  return priority;
}

function getSelectedTagIds(selections: JobTagSelections): number[] {
  return Object.values(selections).reduce<number[]>((tagIds, tagId) => {
    const parsed = Number(tagId);
    if (Number.isFinite(parsed)) {
      tagIds.push(parsed);
    }
    return tagIds;
  }, []);
}

function getJobTagSelections(tags: ApiTag[] | undefined): JobTagSelections {
  return (tags ?? []).reduce<JobTagSelections>((selections, tagItem) => {
    if (tagItem.groupId === undefined) {
      return selections;
    }
    const numericId = toNumericId(getTagId(tagItem));
    if (numericId !== undefined) {
      selections[String(tagItem.groupId)] = String(numericId);
    }
    return selections;
  }, {});
}

function getUserLabel(user: User): string {
  const name = user.realName || user.username || `User #${String(user.id)}`;
  return user.email ? `${name} (${user.email})` : name;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (isRequestError(error)) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
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
  const [selectedTagGroup, setSelectedTagGroup] = useState<TagGroup | null>(null);
  const [jobForm, setJobForm] = useState<JobFormState>(defaultJobForm);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(defaultCategoryForm);
  const [tagGroupForm, setTagGroupForm] = useState<TagGroupFormState>(defaultTagGroupForm);
  const [tagForm, setTagForm] = useState<TagFormState>(defaultTagForm);
  const [jobTagSelections, setJobTagSelections] = useState<JobTagSelections>({});
  const [jobTagsTouched, setJobTagsTouched] = useState(false);
  const [loadingJobId, setLoadingJobId] = useState<ApiId | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<ApiId | null>(null);
  const [jobActionError, setJobActionError] = useState<string | null>(null);

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

  const ownerOptionsQuery = useQuery({
    queryKey: ["users", "owner-options", { status: "active" }],
    queryFn: () => listUsers({ page: 1, pageSize: 200, status: "active" }),
    enabled: modal === "job",
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
    queryKey: ["tags", "grouped", { status: "active" }],
    queryFn: () => listGroupedTags({ status: "active" }),
    enabled: modal === "job",
  });

  const ownerOptions = ownerOptionsQuery.data?.items ?? [];
  const selectedOwnerId = idToString(selectedJob?.ownerUserId);
  const shouldShowSelectedOwnerFallback =
    selectedOwnerId.length > 0 && !ownerOptions.some((user) => String(user.id) === selectedOwnerId);

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

  const populateJobForm = (job: Job) => {
    setSelectedJob(job);
    setJobForm({
      title: job.title,
      categoryId: idToString(job.categoryId),
      salaryMin: idToString(job.salaryMin),
      salaryMax: idToString(job.salaryMax),
      salaryMonths: idToString(job.salaryMonths),
      headcount: idToString(job.headcount),
      ownerUserId: idToString(job.ownerUserId),
      priority: normalizePriority(job.priority),
      status: job.status || "draft",
      description: job.description ?? "",
      responsibilities: job.responsibilities ?? "",
      requirements: job.requirements ?? "",
      bonusPoints: job.bonusPoints ?? "",
    });
    setJobTagSelections(getJobTagSelections(job.tags));
    setJobTagsTouched(false);
  };

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

  const deleteJobMutation = useMutation({
    mutationFn: deleteJob,
    onSuccess: () => {
      setJobActionError(null);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error) => setJobActionError(getErrorMessage(error, "Failed to delete job.")),
    onSettled: () => setDeletingJobId(null),
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
      queryClient.invalidateQueries({ queryKey: ["tags", "grouped"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to create tag group.")),
  });

  const updateTagGroupMutation = useMutation({
    mutationFn: ({ id, payload }: { id: ApiId; payload: UpdateTagGroupRequest }) => updateTagGroup(id, payload),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["tag-groups"] });
      queryClient.invalidateQueries({ queryKey: ["tags", "grouped"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to update tag group.")),
  });

  const createTagMutation = useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["tags", "grouped"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to create tag.")),
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, payload }: { id: ApiId; payload: UpdateTagRequest }) => updateTag(id, payload),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["tags", "grouped"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to update tag.")),
  });

  const closeModal = () => {
    setModal(null);
    setFormError(null);
    setSelectedJob(null);
    setSelectedCategory(null);
    setSelectedTag(null);
    setSelectedTagGroup(null);
    setJobForm(defaultJobForm);
    setCategoryForm(defaultCategoryForm);
    setTagGroupForm(defaultTagGroupForm);
    setTagForm(defaultTagForm);
    setJobTagSelections({});
    setJobTagsTouched(false);
  };

  const openCreateJob = () => {
    setJobForm(defaultJobForm);
    setJobTagSelections({});
    setJobTagsTouched(false);
    setSelectedJob(null);
    setFormError(null);
    setJobActionError(null);
    setModal("job");
  };

  const openEditJob = async (job: Job) => {
    setLoadingJobId(job.id);
    setJobActionError(null);
    setFormError(null);
    try {
      const jobDetail = await getJob(job.id);
      populateJobForm(jobDetail);
      setModal("job");
    } catch (error) {
      setJobActionError(getErrorMessage(error, "Failed to load job details."));
    } finally {
      setLoadingJobId(null);
    }
  };

  const handleDeleteJob = (job: Job) => {
    const confirmed = window.confirm(`Delete job "${job.title}"?`);
    if (!confirmed) {
      return;
    }
    setDeletingJobId(job.id);
    setJobActionError(null);
    deleteJobMutation.mutate(job.id);
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
      status: category.status === "disabled" ? "disabled" : "active",
    });
    setFormError(null);
    setModal("category");
  };

  const openCreateTagGroup = () => {
    setTagGroupForm(defaultTagGroupForm);
    setSelectedTagGroup(null);
    setFormError(null);
    setModal("group");
  };

  const openEditTagGroup = (group: TagGroup) => {
    setSelectedTagGroup(group);
    setTagGroupForm({
      name: group.name,
      description: group.description ?? "",
      status: group.status === "disabled" ? "disabled" : "active",
    });
    setFormError(null);
    setModal("group");
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

  const submitJob = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const title = jobForm.title.trim();
    const priority = normalizePriority(jobForm.priority.trim());
    const status = jobForm.status.trim();
    if (!title) {
      setFormError("Job title is required.");
      return;
    }
    if (!status) {
      setFormError("Job status is required.");
      return;
    }
    if (!priority) {
      setFormError("Job priority is required.");
      return;
    }

    const tagIds = getSelectedTagIds(jobTagSelections);

    if (selectedJob) {
      const updatePayload: UpdateJobRequest = {
        title,
        categoryId: toNullableNumber(jobForm.categoryId),
        salaryMin: toNullableNumber(jobForm.salaryMin),
        salaryMax: toNullableNumber(jobForm.salaryMax),
        salaryMonths: toNullableNumber(jobForm.salaryMonths),
        headcount: toNullableNumber(jobForm.headcount),
        priority,
        status,
        description: jobForm.description.trim(),
        responsibilities: jobForm.responsibilities.trim(),
        requirements: jobForm.requirements.trim(),
        bonusPoints: jobForm.bonusPoints.trim(),
        tagIds: jobTagsTouched ? tagIds : undefined,
      };
      const ownerUserId = toOptionalNumber(jobForm.ownerUserId);
      if (ownerUserId !== undefined) {
        updatePayload.ownerUserId = ownerUserId;
      }
      updateJobMutation.mutate({
        id: selectedJob.id,
        payload: updatePayload,
      });
      return;
    }

    const createPayload: CreateJobRequest = {
      title,
      status,
      priority,
    };
    const categoryId = toOptionalNumber(jobForm.categoryId);
    const salaryMin = toOptionalNumber(jobForm.salaryMin);
    const salaryMax = toOptionalNumber(jobForm.salaryMax);
    const salaryMonths = toOptionalNumber(jobForm.salaryMonths);
    const headcount = toOptionalNumber(jobForm.headcount);
    const ownerUserId = toOptionalNumber(jobForm.ownerUserId);
    const description = jobForm.description.trim();
    const responsibilities = jobForm.responsibilities.trim();
    const requirements = jobForm.requirements.trim();
    const bonusPoints = jobForm.bonusPoints.trim();
    if (categoryId !== undefined) createPayload.categoryId = categoryId;
    if (salaryMin !== undefined) createPayload.salaryMin = salaryMin;
    if (salaryMax !== undefined) createPayload.salaryMax = salaryMax;
    if (salaryMonths !== undefined) createPayload.salaryMonths = salaryMonths;
    if (headcount !== undefined) createPayload.headcount = headcount;
    if (ownerUserId !== undefined) createPayload.ownerUserId = ownerUserId;
    if (description) createPayload.description = description;
    if (responsibilities) createPayload.responsibilities = responsibilities;
    if (requirements) createPayload.requirements = requirements;
    if (bonusPoints) createPayload.bonusPoints = bonusPoints;
    if (tagIds.length > 0) createPayload.tagIds = tagIds;
    createJobMutation.mutate(createPayload);
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
      status: tagGroupForm.status,
    };

    if (selectedTagGroup) {
      updateTagGroupMutation.mutate({
        id: selectedTagGroup.id,
        payload: {
          ...payload,
          status: tagGroupForm.status,
        },
      });
      return;
    }

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
      status: tagForm.status,
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

  const isSaving =
    createJobMutation.isPending ||
    updateJobMutation.isPending ||
    createCategoryMutation.isPending ||
    updateCategoryMutation.isPending ||
    createTagGroupMutation.isPending ||
    updateTagGroupMutation.isPending ||
    createTagMutation.isPending ||
    updateTagMutation.isPending;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:mb-8">
        <div>
          <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">Job Management</h1>
          <p className="text-sm text-gray-600 md:text-base">Manage jobs, categories, and matching tags.</p>
        </div>
        <button
          type="button"
          onClick={activeTab === "jobs" ? openCreateJob : activeTab === "categories" ? openCreateCategory : activeTab === "tags" ? openCreateTag : openCreateTagGroup}
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
          {jobActionError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{jobActionError}</div>}
          {!jobsQuery.isLoading && !jobsQuery.isError && (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3 text-sm text-gray-500">
                Total {jobsQuery.data?.total ?? 0} jobs
              </div>
              <div className="divide-y divide-gray-200">
                {(jobsQuery.data?.items ?? []).map((job) => {
                  const isLoadingThisJob = String(loadingJobId) === String(job.id);
                  const isDeletingThisJob = String(deletingJobId) === String(job.id);
                  const isJobActionBusy = loadingJobId !== null || deletingJobId !== null;
                  return (
                    <div key={String(job.id)} className="p-4 transition-colors hover:bg-gray-50">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-semibold text-gray-900">{job.title}</h3>
                            <StatusBadge value={job.status} />
                            {job.priority && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${getPriorityStyle(job.priority)}`}>{job.priority}</span>}
                          </div>
                          <div className="grid gap-2 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-3">
                            <span>Category: {job.categoryName ?? categoryNameById.get(String(job.categoryId)) ?? "-"}</span>
                            <span>Headcount: {job.headcount ?? "-"}</span>
                            <span>Owner: {(job.ownerName ?? idToString(job.ownerUserId)) || "-"}</span>
                          </div>
                          {(job.tags ?? []).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(job.tags ?? []).map((tagItem) => (
                                <span key={String(getTagId(tagItem) ?? tagItem.name)} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                                  {tagItem.name}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="mt-3 line-clamp-2 text-sm text-gray-600">{job.description || job.requirements || "No description."}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditJob(job)}
                            disabled={isJobActionBusy}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isLoadingThisJob ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
                            {isLoadingThisJob ? "Loading" : "Edit"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteJob(job)}
                            disabled={isJobActionBusy}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isDeletingThisJob ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            {isDeletingThisJob ? "Deleting" : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                  <div className="mt-4 flex justify-end">
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
                      <p className="mt-1 text-sm text-gray-500">ID: {String(group.id)}</p>
                    </div>
                    <StatusBadge value={group.status} />
                  </div>
                  <p className="text-sm text-gray-600">{group.description || "No description."}</p>
                  <div className="mt-4 flex justify-end">
                    <button type="button" onClick={() => openEditTagGroup(group)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </button>
                  </div>
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
              <SelectField label="Status" value={jobForm.status} onChange={(value) => setJobForm({ ...jobForm, status: value })} options={["draft", "published", "closed"]} />
              <SelectField label="Priority" value={jobForm.priority} onChange={(value) => setJobForm({ ...jobForm, priority: value })} options={["normal", "low", "high", "urgent"]} />
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Owner
                <select value={jobForm.ownerUserId} onChange={(event) => setJobForm({ ...jobForm, ownerUserId: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-normal focus:border-transparent focus:ring-2 focus:ring-blue-500">
                  <option value="">{selectedJob ? "Keep current owner" : "Current user"}</option>
                  {shouldShowSelectedOwnerFallback && <option value={selectedOwnerId}>Current owner #{selectedOwnerId}</option>}
                  {ownerOptions.map((user) => (
                    <option key={String(user.id)} value={String(user.id)}>
                      {getUserLabel(user)}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Salary Min" type="number" value={jobForm.salaryMin} onChange={(value) => setJobForm({ ...jobForm, salaryMin: value })} />
              <Field label="Salary Max" type="number" value={jobForm.salaryMax} onChange={(value) => setJobForm({ ...jobForm, salaryMax: value })} />
              <Field label="Salary Months" type="number" value={jobForm.salaryMonths} onChange={(value) => setJobForm({ ...jobForm, salaryMonths: value })} />
              <Field label="Headcount" type="number" value={jobForm.headcount} onChange={(value) => setJobForm({ ...jobForm, headcount: value })} />
            </div>
            <QueryState loading={tagOptionsQuery.isLoading} error={tagOptionsQuery.error} fallback="Failed to load grouped tags." />
            {!tagOptionsQuery.isLoading && !tagOptionsQuery.isError && (tagOptionsQuery.data ?? []).length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {(tagOptionsQuery.data ?? []).map((group) => (
                  <label key={String(group.id)} className="space-y-1 text-sm font-medium text-gray-700">
                    {group.name}
                    <select
                      value={jobTagSelections[String(group.id)] ?? ""}
                      onChange={(event) => {
                        setJobTagsTouched(true);
                        setJobTagSelections((current) => ({
                          ...current,
                          [String(group.id)]: event.target.value,
                        }));
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 font-normal focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">None</option>
                      {(group.tags ?? []).map((tagItem) => {
                        const tagId = getTagId(tagItem);
                        if (tagId === undefined) {
                          return null;
                        }
                        return (
                          <option key={String(tagId)} value={String(tagId)}>
                            {tagItem.name}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                ))}
              </div>
            )}
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
            </div>
            <TextArea label="Description" value={categoryForm.description} onChange={(value) => setCategoryForm({ ...categoryForm, description: value })} />
            <FormActions error={formError} isSaving={isSaving} onCancel={closeModal} />
          </form>
        </Modal>
      )}

      {modal === "group" && (
        <Modal title={selectedTagGroup ? "Edit Tag Group" : "Create Tag Group"} onClose={closeModal}>
          <form onSubmit={submitTagGroup} className="space-y-5 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" value={tagGroupForm.name} onChange={(value) => setTagGroupForm({ ...tagGroupForm, name: value })} required />
              <SelectField label="Status" value={tagGroupForm.status} onChange={(value) => setTagGroupForm({ ...tagGroupForm, status: value as TagGroupStatus })} options={["active", "disabled"]} />
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
