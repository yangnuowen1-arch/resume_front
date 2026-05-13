import { useState } from "react";
import { Upload, File, X, CheckCircle, Sparkles } from "lucide-react";

export default function ResumesPage() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState("");

  const jobs = ["Senior Frontend Developer", "Product Manager", "UX Designer", "Backend Engineer", "Data Scientist"];
  const addFile = (fileName: string) => !selectedFiles.includes(fileName) && setSelectedFiles([...selectedFiles, fileName]);
  const removeFile = (fileName: string) => setSelectedFiles(selectedFiles.filter((f) => f !== fileName));

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">Resume Upload</h1>
        <p className="text-sm text-gray-600 md:text-base">Upload candidate resumes for AI screening</p>
      </div>
      <div className="max-w-4xl">
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Select Target Job</h2>
          <select value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-blue-500">
            <option value="">Choose a job position...</option>
            {jobs.map((job) => <option key={job} value={job}>{job}</option>)}
          </select>
        </div>

        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Upload Resumes</h2>
          <div className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-12 text-center transition-all hover:border-blue-400 hover:bg-blue-50/50" onClick={() => addFile(`Resume_${selectedFiles.length + 1}.pdf`)}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <Upload className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-gray-900">Drop files here or click to upload</h3>
            <p className="mb-4 text-sm text-gray-500">Support for PDF and DOCX files up to 10MB</p>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Choose Files</button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-6 space-y-2">
              {selectedFiles.map((file) => (
                <div key={file} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100"><File className="h-5 w-5 text-blue-600" /></div>
                    <p className="text-sm font-medium text-gray-900">{file}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <button onClick={() => removeFile(file)} className="rounded-lg p-1 hover:bg-gray-200"><X className="h-5 w-5 text-gray-400" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button className="rounded-lg px-6 py-3 text-gray-700 hover:bg-gray-100">Cancel</button>
          <button disabled={!selectedJob || selectedFiles.length === 0} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
            <Sparkles className="h-5 w-5" />Start AI Screening
          </button>
        </div>
      </div>
    </div>
  );
}
