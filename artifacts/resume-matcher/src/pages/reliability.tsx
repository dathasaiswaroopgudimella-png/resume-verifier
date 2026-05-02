import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGetReliabilitySummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Target, Shield, Coins, BookOpen } from "lucide-react";

export default function ReliabilityPage() {
  const { data: summary, isLoading, error } = useGetReliabilitySummary();

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold">System Reliability</h1>
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (error || !summary) {
    return <div>Failed to load reliability summary.</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">System Reliability Charter</h1>
        <p className="text-muted-foreground">Design philosophy, boundary conditions, and known failure modes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 border-slate-800 text-white md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Decision Philosophy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <blockquote className="border-l-4 border-primary pl-4 py-2 italic text-lg text-slate-300 leading-relaxed font-serif">
              "{summary.decisionPhilosophy}"
            </blockquote>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardHeader>
            <CardTitle className="text-sm text-slate-400">Core Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Agreement Score</span>
                <span className="font-mono">{(summary.agreementScore * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${summary.agreementScore * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Precision Focus</span>
                <span className="font-mono">{(summary.precision * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${summary.precision * 100}%` }} />
              </div>
            </div>
            <div className="pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Ranking Stability</span>
              <Badge className="bg-emerald-950/50 text-emerald-400 border border-emerald-900">{summary.rankingStability}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Known Failure Modes
            </CardTitle>
            <CardDescription>Areas where the engine exhibits degraded performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {summary.keyFailureModes.map((mode, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <div className="mt-0.5 rounded-full bg-amber-500/10 p-1">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                  </div>
                  <span className="leading-relaxed">{mode}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              System Boundaries
            </CardTitle>
            <CardDescription>Strict limitations of the evaluation model</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {summary.systemBoundaries.map((boundary, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <div className="mt-0.5 rounded-full bg-blue-500/10 p-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  </div>
                  <span className="leading-relaxed">{boundary}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Cost Function Model
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 rounded-lg bg-red-950/20 border border-red-900/30">
            <h4 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">False Positive Cost</h4>
            <div className="text-2xl font-bold text-slate-200">{summary.costModel.falsePositiveCost}</div>
            <p className="text-xs text-slate-500 mt-2">Hiring someone who cannot do the job.</p>
          </div>
          <div className="p-4 rounded-lg bg-blue-950/20 border border-blue-900/30">
            <h4 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-2">False Negative Cost</h4>
            <div className="text-2xl font-bold text-slate-200">{summary.costModel.falseNegativeCost}</div>
            <p className="text-xs text-slate-500 mt-2">Missing out on a qualified candidate.</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Optimization Target</h4>
            <div className="text-base font-medium text-slate-200 leading-snug">{summary.costModel.prioritization}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}