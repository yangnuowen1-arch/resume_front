import { Link } from "react-router-dom";
import { Search, ChevronRight, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export function ScreeningResults() {
  const results = [
    { id: 1, name: "Sarah Johnson", position: "Senior Frontend Developer", score: 92, matchedSkills: ["React", "TypeScript", "Tailwind CSS"], missingSkills: ["Vue.js"], riskTags: [], recommendation: "Pass" },
    { id: 2, name: "Michael Chen", position: "Product Manager", score: 88, matchedSkills: ["Product Strategy", "Agile"], missingSkills: ["A/B Testing"], riskTags: ["Short tenure"], recommendation: "Pass" },
    { id: 3, name: "Emily Davis", position: "UX Designer", score: 75, matchedSkills: ["Figma", "UI Design"], missingSkills: ["User Research"], riskTags: ["Limited portfolio"], recommendation: "Review" },
    { id: 4, name: "David Kim", position: "Backend Engineer", score: 45, matchedSkills: ["Python"], missingSkills: ["Node.js", "PostgreSQL"], riskTags: ["Skill mismatch"], recommendation: "Reject" },
  ];

  const getScoreColor = (score: number) => (score >= 80 ? "text-green-600 bg-green-50" : score >= 60 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50");
  const getRecommendationConfig = (recommendation: string) =>
    recommendation === "Pass"
      ? { icon: CheckCircle, color: "text-green-700", bg: "bg-green-100" }
      : recommendation === "Review"
        ? { icon: AlertTriangle, color: "text-yellow-700", bg: "bg-yellow-100" }
        : { icon: XCircle, color: "text-red-700", bg: "bg-red-100" };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">Screening Results</h1>
        <p className="text-sm text-gray-600 md:text-base">Review AI-generated candidate evaluations</p>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search candidates..." className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="space-y-4">
        {results.map((result) => {
          const recConfig = getRecommendationConfig(result.recommendation);
          const RecIcon = recConfig.icon;
          return (
            <Link key={result.id} to={`/screening/${result.id}`} className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md md:p-6">
              <div className="flex items-start gap-3 md:gap-6">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                  <span className="text-sm font-medium text-white">{result.name.split(" ").map((n) => n[0]).join("")}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{result.name}</h3>
                      <p className="text-sm text-gray-500">{result.position}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex rounded-lg px-3 py-1.5 ${getScoreColor(result.score)}`}>{result.score}%</span>
                    <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ${recConfig.bg}`}>
                      <RecIcon className={`h-4 w-4 ${recConfig.color}`} />
                      <span className={`text-sm font-medium ${recConfig.color}`}>{result.recommendation}</span>
                    </div>
                    {result.riskTags.length > 0 && (
                      <span className="inline-flex rounded bg-yellow-50 px-2 py-1 text-xs text-yellow-700">{result.riskTags[0]}</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
