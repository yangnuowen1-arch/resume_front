import { useParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle, Mail, Phone, MapPin } from "lucide-react";

export default function ScreeningDetailPage() {
  const { id } = useParams();
  const candidate = {
    id,
    name: "Sarah Johnson",
    position: "Senior Frontend Developer",
    email: "sarah.johnson@email.com",
    phone: "+1 (555) 123-4567",
    location: "San Francisco, CA",
    score: 92,
    recommendation: "Pass",
    summary: "Highly skilled frontend developer with 6+ years of experience building scalable web applications.",
  };

  const recConfig = candidate.recommendation === "Pass"
    ? { icon: CheckCircle, color: "text-green-700", bg: "bg-green-100", borderColor: "border-green-200" }
    : candidate.recommendation === "Review"
      ? { icon: AlertTriangle, color: "text-yellow-700", bg: "bg-yellow-100", borderColor: "border-yellow-200" }
      : { icon: XCircle, color: "text-red-700", bg: "bg-red-100", borderColor: "border-red-200" };
  const RecIcon = recConfig.icon;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 md:mb-8">
        <Link to="/screening" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 md:text-base">
          <ArrowLeft className="h-4 w-4" />Back to Results
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
              <span className="text-xl font-medium text-white">{candidate.name.split(" ").map((n) => n[0]).join("")}</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{candidate.name}</h1>
              <p className="mb-2 text-gray-600">{candidate.position}</p>
              <div className="flex flex-col gap-1 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4" />{candidate.email}</span>
                <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" />{candidate.phone}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{candidate.location}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2 md:space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Resume Summary</h2>
            <p className="text-gray-700">{candidate.summary}</p>
          </div>
        </div>
        <div className="space-y-4 md:space-y-6">
          <div className={`rounded-lg border-2 bg-white p-6 shadow-sm ${recConfig.borderColor}`}>
            <div className="mb-3 text-center">
              <div className="mx-auto mb-3 inline-flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                <span className="text-4xl font-bold text-white">{candidate.score}</span>
              </div>
              <p className="text-sm text-gray-600">AI Match Score</p>
            </div>
            <div className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 ${recConfig.bg}`}>
              <RecIcon className={`h-5 w-5 ${recConfig.color}`} />
              <span className={`font-medium ${recConfig.color}`}>{candidate.recommendation}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
