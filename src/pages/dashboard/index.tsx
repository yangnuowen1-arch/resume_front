import { Users, Clock, CheckCircle, XCircle, TrendingUp, Calendar } from "lucide-react";

export default function DashboardPage() {
  const stats = [
    { label: "Total Resumes", value: "1,247", change: "+12.5%", trend: "up", icon: Users, color: "blue" },
    { label: "Pending Screening", value: "38", change: "-5.2%", trend: "down", icon: Clock, color: "yellow" },
    { label: "Recommended", value: "156", change: "+18.3%", trend: "up", icon: CheckCircle, color: "green" },
    { label: "Rejected", value: "892", change: "+8.1%", trend: "up", icon: XCircle, color: "red" },
  ] as const;

  const recentScreenings = [
    { id: 1, candidate: "Sarah Johnson", position: "Senior Frontend Developer", score: 92, status: "Recommended", date: "2026-05-09 10:30" },
    { id: 2, candidate: "Michael Chen", position: "Product Manager", score: 88, status: "Recommended", date: "2026-05-09 09:15" },
    { id: 3, candidate: "Emily Davis", position: "UX Designer", score: 75, status: "Review Required", date: "2026-05-09 08:45" },
    { id: 4, candidate: "David Kim", position: "Backend Engineer", score: 45, status: "Rejected", date: "2026-05-08 16:20" },
    { id: 5, candidate: "Lisa Anderson", position: "Data Scientist", score: 91, status: "Recommended", date: "2026-05-08 15:10" },
  ];

  const getScoreColor = (score: number) => (score >= 80 ? "text-green-600 bg-green-50" : score >= 60 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50");
  const getStatusColor = (status: string) => (status === "Recommended" ? "text-green-700 bg-green-100" : status === "Review Required" ? "text-yellow-700 bg-yellow-100" : "text-red-700 bg-red-100");

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">Dashboard Overview</h1>
        <p className="text-sm text-gray-600 md:text-base">Welcome back! Here&apos;s what&apos;s happening with your recruitment.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:mb-8 md:gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const colorClasses = { blue: { bg: "bg-blue-50", text: "text-blue-600" }, yellow: { bg: "bg-yellow-50", text: "text-yellow-600" }, green: { bg: "bg-green-50", text: "text-green-600" }, red: { bg: "bg-red-50", text: "text-red-600" } }[stat.color];
          return (
            <div key={stat.label} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-4 flex items-start justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${colorClasses.bg}`}>
                  <Icon className={`h-6 w-6 ${colorClasses.text}`} />
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className={`h-4 w-4 ${stat.trend === "up" ? "text-green-600" : "rotate-180 text-red-600"}`} />
                  <span className={stat.trend === "up" ? "text-green-600" : "text-red-600"}>{stat.change}</span>
                </div>
              </div>
              <h3 className="mb-1 text-3xl font-semibold text-gray-900">{stat.value}</h3>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-4 md:px-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 md:text-lg">Recent Screening Tasks</h2>
            <button className="text-xs font-medium text-blue-600 hover:text-blue-700 md:text-sm">View All</button>
          </div>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                {["Candidate", "Position", "AI Score", "Status", "Date"].map((head) => (
                  <th key={head} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {recentScreenings.map((screening) => (
                <tr key={screening.id} className="transition-colors hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                        <span className="text-xs font-medium text-white">{screening.candidate.split(" ").map((n) => n[0]).join("")}</span>
                      </div>
                      <span className="ml-3 text-sm font-medium text-gray-900">{screening.candidate}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">{screening.position}</td>
                  <td className="whitespace-nowrap px-6 py-4"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getScoreColor(screening.score)}`}>{screening.score}%</span></td>
                  <td className="whitespace-nowrap px-6 py-4"><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(screening.status)}`}>{screening.status}</span></td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500"><div className="flex items-center gap-1"><Calendar className="h-4 w-4" />{screening.date}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
