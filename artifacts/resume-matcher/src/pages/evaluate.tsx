import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useGetEvaluationMetrics } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

export default function EvaluatePage() {
  const { data: metrics, isLoading, error } = useGetEvaluationMetrics();

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold">System Evaluation</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (error || !metrics) {
    return <div>Failed to load metrics.</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">System Evaluation</h1>
        <p className="text-muted-foreground">Performance of the engine against human validation sets.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{(metrics.accuracy * 100).toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Precision</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{(metrics.precision * 100).toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Recall</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{(metrics.recall * 100).toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">False Positives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-red-400">{metrics.falsePositives}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">False Negatives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-amber-400">{metrics.falseNegatives}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Human Agreement</CardTitle>
            <CardDescription>Correlation with human recruiter decisions</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-around h-48">
            <div className="h-40 w-40 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart 
                  cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={10} 
                  data={[{ value: metrics.agreementScore * 100, fill: "hsl(var(--primary))" }]}
                  startAngle={90} endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={10} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{(metrics.agreementScore * 100).toFixed(0)}%</span>
              </div>
            </div>

            <div className="space-y-4 flex-1 max-w-[200px]">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Rank Correlation (Spearman)</div>
                <div className="text-2xl font-bold font-mono">{metrics.rankCorrelation.toFixed(3)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Total Cases Validated</div>
                <div className="text-2xl font-bold font-mono">{metrics.totalCases}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Validation Cases</CardTitle>
          <CardDescription>Detailed breakdown of system vs human decisions</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Resume</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>System Score</TableHead>
              <TableHead>System Decision</TableHead>
              <TableHead>Human Decision</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Failure Mode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.cases.map((c, i) => (
              <TableRow key={i} className={c.agree ? "bg-emerald-500/5 dark:bg-emerald-500/10" : "bg-red-500/5 dark:bg-red-500/10"}>
                <TableCell className="font-mono text-xs">{c.resumeId.substring(0,8)}</TableCell>
                <TableCell className="font-mono text-xs">{c.jobId.substring(0,8)}</TableCell>
                <TableCell className="font-mono">{c.systemScore}</TableCell>
                <TableCell><Badge variant="outline">{c.systemDecision}</Badge></TableCell>
                <TableCell><Badge variant="outline">{c.humanDecision}</Badge></TableCell>
                <TableCell>
                  {c.agree ? (
                    <Badge className="bg-emerald-600">Agree</Badge>
                  ) : (
                    <Badge variant="destructive">Disagree</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.failureMode || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}