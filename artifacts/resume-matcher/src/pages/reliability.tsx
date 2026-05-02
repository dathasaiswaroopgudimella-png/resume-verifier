import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGetReliabilitySummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Shield, Coins, BookOpen } from "lucide-react";

function MetricBar({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-200 font-mono">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ReliabilityPage() {
  const { data: summary, isLoading, error } = useGetReliabilitySummary();

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <div className="h-7 w-64 bg-slate-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-80 bg-slate-800 rounded animate-pulse" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return <div className="text-red-400 text-sm">Failed to load reliability summary.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reliability Charter</h1>
        <p className="text-sm text-slate-500 mt-1">
          Design philosophy, measured performance, known limitations, and failure modes.
        </p>
      </div>

      {/* Philosophy + Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-xl border border-slate-700 bg-slate-900/80 p-6">
          <div className="flex items-center gap-2 mb-4 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
            <BookOpen className="w-3.5 h-3.5" /> Design Philosophy
          </div>
          <blockquote className="border-l-4 border-primary pl-5 py-1 italic text-base text-slate-300 leading-relaxed font-serif">
            "{summary.decisionPhilosophy}"
          </blockquote>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
            Live Metrics
          </div>
          <MetricBar
            label="Agreement score"
            value={`${(summary.agreementScore * 100).toFixed(1)}%`}
            pct={summary.agreementScore * 100}
          />
          <MetricBar
            label="Precision"
            value={`${(summary.precision * 100).toFixed(1)}%`}
            pct={summary.precision * 100}
          />
          <div className="pt-1">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
              Ranking stability
            </div>
            <Badge
              className={
                summary.rankingStability === "HIGH"
                  ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900 text-xs"
                  : summary.rankingStability === "MEDIUM"
                  ? "bg-amber-950/50 text-amber-400 border border-amber-900 text-xs"
                  : "bg-red-950/50 text-red-400 border border-red-900 text-xs"
              }
            >
              {summary.rankingStability}
            </Badge>
          </div>
        </div>
      </div>

      {/* Failure modes + Boundaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center gap-2 mb-4 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Known Failure Modes
          </div>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Areas where the engine exhibits degraded performance. Knowing where it fails builds appropriate trust.
          </p>
          <ul className="space-y-3">
            {summary.keyFailureModes.map((mode, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span className="text-slate-300 leading-relaxed">{mode}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center gap-2 mb-4 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
            <Shield className="w-3.5 h-3.5 text-blue-500" /> System Boundaries
          </div>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Hard constraints — inputs or scenarios the system was not designed to handle.
          </p>
          <ul className="space-y-3">
            {summary.systemBoundaries.map((b, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <span className="text-slate-300 leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Cost model */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-6">
        <div className="flex items-center gap-2 mb-6 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
          <Coins className="w-3.5 h-3.5" /> Cost Function Model
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-4">
            <div className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-2">
              False Positive Cost
            </div>
            <div className="text-xl font-bold text-slate-200 mb-2">{summary.costModel.falsePositiveCost}</div>
            <p className="text-xs text-slate-500">Interviewing or hiring someone unable to do the job. High cost in time, salary, and team impact.</p>
          </div>
          <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 p-4">
            <div className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-2">
              False Negative Cost
            </div>
            <div className="text-xl font-bold text-slate-200 mb-2">{summary.costModel.falseNegativeCost}</div>
            <p className="text-xs text-slate-500">Missing a qualified candidate. Opportunity cost — less severe than a bad hire in most roles.</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Optimization Target
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">{summary.costModel.prioritization}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
