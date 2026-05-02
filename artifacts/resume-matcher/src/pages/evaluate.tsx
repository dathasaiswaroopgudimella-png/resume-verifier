import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGetEvaluationMetrics } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { CheckCircle, XCircle } from "lucide-react";

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">{label}</div>
      <div className={`text-3xl font-bold font-mono tabular-nums ${accent ?? "text-slate-100"}`}>{value}</div>
      {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
    </div>
  );
}

function rankCorrelationLabel(r: number) {
  if (r >= 0.8) return "Strong positive — system ranking closely matches human judgment";
  if (r >= 0.6) return "Moderate positive — generally agrees, some reordering";
  if (r >= 0.4) return "Weak positive — rough agreement, notable divergences";
  if (r >= 0) return "Near random — low agreement with human ranking";
  return "Negative — system inverts human judgment";
}

export default function EvaluatePage() {
  const { data: metrics, isLoading, error } = useGetEvaluationMetrics();

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <div className="h-7 w-48 bg-slate-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (error || !metrics) {
    return <div className="text-red-400 text-sm">Failed to load evaluation metrics.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Evaluation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Live performance against {metrics.totalCases} human-validated resume–job pairs.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Accuracy"
          value={`${(metrics.accuracy * 100).toFixed(0)}%`}
          sub="Decision agreement rate"
        />
        <KpiCard
          label="Precision"
          value={`${(metrics.precision * 100).toFixed(0)}%`}
          sub="No false approvals"
          accent={metrics.precision >= 0.9 ? "text-emerald-400" : "text-amber-400"}
        />
        <KpiCard
          label="Recall"
          value={`${(metrics.recall * 100).toFixed(0)}%`}
          sub="Good candidates found"
        />
        <KpiCard
          label="False Positives"
          value={String(metrics.falsePositives)}
          sub="Unqualified approved"
          accent={metrics.falsePositives === 0 ? "text-emerald-400" : "text-red-400"}
        />
        <KpiCard
          label="False Negatives"
          value={String(metrics.falseNegatives)}
          sub="Qualified missed"
          accent={metrics.falseNegatives <= 2 ? "text-amber-400" : "text-red-400"}
        />
      </div>

      {/* Human agreement gauge */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 rounded-xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col items-center justify-center">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-4">Human Agreement</div>
          <div className="relative h-36 w-36">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%" cy="50%"
                innerRadius="68%" outerRadius="100%"
                barSize={10}
                data={[{ value: metrics.agreementScore * 100, fill: "hsl(217 91% 60%)" }]}
                startAngle={90} endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar background={{ fill: "#1e293b" }} dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tabular-nums text-slate-100">
                {(metrics.agreementScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
              Rank Correlation (Spearman)
            </div>
            <div className="text-4xl font-bold font-mono tabular-nums text-slate-100 mb-1">
              {metrics.rankCorrelation.toFixed(3)}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {rankCorrelationLabel(metrics.rankCorrelation)}
            </p>
          </div>
          <div className="h-px bg-slate-800" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">
                Cases validated
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-100">{metrics.totalCases}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">
                Design priority
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Precision over recall — minimize false approvals. A missed good candidate costs less than a bad hire.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Validation table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <h2 className="text-sm font-semibold text-slate-200">Validation Cases</h2>
          <p className="text-xs text-slate-500 mt-0.5">System vs human recruiter decisions, case by case</p>
        </div>
        <div className="divide-y divide-slate-800/60">
          {metrics.cases.map((c, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 px-5 py-3 text-sm ${
                c.agree
                  ? "bg-emerald-950/10 hover:bg-emerald-950/20"
                  : "bg-red-950/10 hover:bg-red-950/20"
              } transition-colors`}
            >
              <div className="w-5 shrink-0">
                {c.agree
                  ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                  : <XCircle className="w-4 h-4 text-red-500" />
                }
              </div>
              <div className="w-28 shrink-0">
                <span className="font-mono text-xs text-slate-300">{c.resumeId}</span>
                <span className="text-slate-600 mx-1">/</span>
                <span className="font-mono text-xs text-slate-300">{c.jobId}</span>
              </div>
              <div className="w-16 shrink-0 text-center">
                <span className="font-mono text-sm text-slate-200 tabular-nums">{c.systemScore}</span>
                <span className="text-slate-600 text-xs">/100</span>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-slate-600 uppercase tracking-wider">System</span>
                  <Badge variant="outline" className="text-xs border-slate-700 w-fit">{c.systemDecision}</Badge>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-slate-600 uppercase tracking-wider">Human</span>
                  <Badge variant="outline" className="text-xs border-slate-700 w-fit">{c.humanDecision}</Badge>
                </div>
              </div>
              <div className="text-xs text-slate-600 max-w-[140px] text-right truncate">
                {c.failureMode ? c.failureMode.replace(/_/g, " ") : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
