import { useState } from "react";
import { Plus, Edit, MoreVertical, Search } from "lucide-react";

export function JobManagement() {
  const [showModal, setShowModal] = useState(false);
  const jobs = [
    { id: 1, title: "Senior Frontend Developer", department: "Engineering", skills: ["React", "TypeScript", "Tailwind CSS"], experience: "5+ years", status: "Active", applicants: 45 },
    { id: 2, title: "Product Manager", department: "Product", skills: ["Product Strategy", "Agile", "Data Analysis"], experience: "3+ years", status: "Active", applicants: 32 },
    { id: 3, title: "UX Designer", department: "Design", skills: ["Figma", "UI/UX", "User Research"], experience: "2+ years", status: "Active", applicants: 28 },
    { id: 4, title: "Backend Engineer", department: "Engineering", skills: ["Node.js", "Python", "PostgreSQL"], experience: "4+ years", status: "Closed", applicants: 67 },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:mb-8">
        <div>
          <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">Job Management</h1>
          <p className="text-sm text-gray-600 md:text-base">Manage job positions and requirements</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-sm text-white shadow-sm transition-all hover:from-blue-700 hover:to-purple-700 md:text-base">
          <Plus className="h-5 w-5" />Create Job
        </button>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center md:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search jobs..." className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 md:gap-6">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex-1">
                <h3 className="mb-1 text-lg font-semibold text-gray-900">{job.title}</h3>
                <p className="text-sm text-gray-500">{job.department}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${job.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{job.status}</span>
                <button className="rounded-lg p-1 hover:bg-gray-100"><MoreVertical className="h-5 w-5 text-gray-400" /></button>
              </div>
            </div>
            <div className="mb-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill) => <span key={skill} className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{skill}</span>)}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-900">{job.experience}</span>
                <span className="text-gray-500">{job.applicants} applicants</span>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-gray-200 pt-4">
              <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-blue-700 hover:bg-blue-100">
                <Edit className="h-4 w-4" />Edit Job
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-6">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Create New Job</h2>
            <div className="space-y-3">
              <input className="w-full rounded-lg border border-gray-300 px-4 py-2" placeholder="Job title" />
              <textarea className="w-full rounded-lg border border-gray-300 px-4 py-2" rows={4} placeholder="Description" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100">Cancel</button>
              <button className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-white">Create Job</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
