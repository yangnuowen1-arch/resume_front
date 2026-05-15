import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Search, LoaderCircle } from "lucide-react";
import { createJobCategory, listJobCategories, type JobCategoryStatus } from "../../api";
import { isRequestError, queryClient } from "../../request";

export default function JobsPage() {
  const [showModal, setShowModal] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | JobCategoryStatus>("");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createStatus, setCreateStatus] = useState<JobCategoryStatus>("active");
  const [createError, setCreateError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["job-categories", { keyword, status: statusFilter }],
    queryFn: () =>
      listJobCategories({
        page: 1,
        pageSize: 20,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
      }),
  });

  const createCategoryMutation = useMutation({
    mutationKey: ["job-categories", "create"],
    mutationFn: createJobCategory,
    onSuccess: () => {
      setShowModal(false);
      setCreateName("");
      setCreateDescription("");
      setCreateStatus("active");
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: ["job-categories"] });
    },
    onError: (error) => {
      const message = isRequestError(error) ? error.message : "Failed to create job category";
      setCreateError(message);
    },
  });

  const categories = categoriesQuery.data?.items ?? [];

  const applySearch = () => {
    setKeyword(keywordInput.trim());
  };

  const resetCreateModal = () => {
    setCreateName("");
    setCreateDescription("");
    setCreateStatus("active");
    setCreateError(null);
  };

  const openCreateModal = () => {
    resetCreateModal();
    setShowModal(true);
  };

  const closeCreateModal = () => {
    if (createCategoryMutation.isPending) {
      return;
    }
    setShowModal(false);
  };

  const handleCreate = () => {
    setCreateError(null);
    const name = createName.trim();

    if (!name) {
      setCreateError("Category name is required.");
      return;
    }

    createCategoryMutation.mutate({
      name,
      description: createDescription.trim() || undefined,
      status: createStatus,
    });
  };

  const getStatusStyle = (status: string) => {
    if (status === "active") {
      return "bg-green-100 text-green-700";
    }
    if (status === "disabled") {
      return "bg-gray-100 text-gray-700";
    }
    return "bg-blue-100 text-blue-700";
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:mb-8">
        <div>
          <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">Job Categories</h1>
          <p className="text-sm text-gray-600 md:text-base">Manage job category dictionary and status</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-sm text-white shadow-sm transition-all hover:from-blue-700 hover:to-purple-700 md:text-base">
          <Plus className="h-5 w-5" />Create Category
        </button>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center md:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search category keyword..."
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applySearch();
                }
              }}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "" | JobCategoryStatus)}
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <button
            type="button"
            onClick={applySearch}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
          >
            Search
          </button>
        </div>
      </div>

      {categoriesQuery.isLoading && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-gray-600 shadow-sm">
          <div className="flex items-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading categories...
          </div>
        </div>
      )}

      {categoriesQuery.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {isRequestError(categoriesQuery.error) ? categoriesQuery.error.message : "Failed to load job categories."}
        </div>
      )}

      {!categoriesQuery.isLoading && !categoriesQuery.isError && (
        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            Total {categoriesQuery.data?.total ?? categories.length} categories
          </div>
          {categories.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
              No job categories found.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 md:gap-6">
              {categories.map((category) => (
                <div key={String(category.id)} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-semibold text-gray-900">{category.name}</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        ID: {String(category.id)}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(category.status)}`}>
                      {category.status}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>{category.description?.trim() || "No description."}</p>
                    <p>Created: {category.createdAt || "-"}</p>
                    <p>Updated: {category.updatedAt || "-"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-6">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Create Job Category</h2>
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                placeholder="Category name"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                disabled={createCategoryMutation.isPending}
              />
              <textarea
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                rows={4}
                placeholder="Description (optional)"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                disabled={createCategoryMutation.isPending}
              />
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                value={createStatus}
                onChange={(event) => setCreateStatus(event.target.value as JobCategoryStatus)}
                disabled={createCategoryMutation.isPending}
              >
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
              {createError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={closeCreateModal} className="rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createCategoryMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-white disabled:opacity-60"
              >
                {createCategoryMutation.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
