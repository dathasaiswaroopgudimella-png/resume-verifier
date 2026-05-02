import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useListJobs, useListResumes, useRankCandidates } from "@workspace/api-client-react";
import type { MatchResultDecision } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, ChevronRight, ListOrdered, Loader2 } from "lucide-react";

function decisionStyle(d: MatchResultDecision) {
  switch (d) {
    case "STRONG_FIT": return "bg-emerald-950/50 text-emerald-400 border-emerald-800/60";
    case "GOOD_FIT":   return "bg-blue-950/50 text-blue-400 border-blue-800/60";
    case "WEAK_FIT":   return "bg-amber-950/40 text-amber-400 border-amber-800/50";
    case "REJECT":     return "bg-red-950/40 text-red-400 border-red-900/50";
    default:           return "bg-slate-900 text-slate-400 border-slate-700";
  }
}

function decisionLabel(d: MatchResultDecision) {
  switch (d) {
    case "STRONG_FIT": return "Strong Fit";
    case "GOOD_FIT":   return "Good Fit";
    case "WEAK_FIT":   return "Weak Fit";
    case "REJECT":     return "Reject";
    default:           return "No Data";
  }
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="flex flex-col items-center gap-0.5">
      <Trophy className="w-5 h-5 text-amber-400" />
      <span className="text-[10px] font-bold text-amber-400">#1</span>
    </div>
  );
  if (rank === 2) return (
    <div className="flex flex-col items-center gap-0.5">
      <Medal className="w-5 h-5 text-slate-300" />
      <span className="text-[10px] font-bold text-slate-300">#2</span>
    </div>
  );
  if (rank === 3) return (
    <div className="flex flex-col items-center gap-0.5">
      <Medal className="w-5 h-5 text-amber-700" />
      <span className="text-[10px] font-bold text-amber-700">#3</span>
    </div>
  );
  return <span className="text-sm text-slate-600 font-mono w-7 text-center">#{rank}</span>;
}

export default function RankPage() {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const { data: jobs, isLoading: isJobsLoading } = useListJobs();
  const { data: resumes } = useListResumes();
  const rankMutation = useRankCandidates();

  const handleRank = () => {
    if (!selectedJobId) return;
    const job = jobs?.find(j => j.id === selectedJobId);
    if (!job) return;
    rankMutation.mutate({ data: { jobText: job.description, jobId: job.id } });
  };

  const ranked = rankMutation.data?.ranked ?? [];
  const comparisons = rankMutation.data?.pairwiseComparisons ?? [];
  const maxScore = ranked.length > 0 ? Math.max(...ranked.map(c => c.matchResult.finalScore), 1) : 100;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Candidate Ranking</h1>
        <p className="text-sm text-slate-500 mt-1">
          Rank all dataset candidates against a target job profile in a single pass.
        </p>
      </div>

      <Card className="border-slate-800 bg-slate-900/40">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="space-y-2 flex-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Target Job Profile
              </label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId} disabled={isJobsLoading}>
                <SelectTrigger className="border-slate-700 bg-slate-900" data-testid="select-job">
                  <SelectValue placeholder="Select a job to rank against…" />
                </SelectTrigger>
                <SelectContent>
                  {jobs?.map(job => (
                    <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleRank}
              disabled={!selectedJobId || rankMutation.isPending}
              data-testid="button-rank"
            >
              {rankMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Ranking…</>
              ) : (
                <><ListOrdered className="w-4 h-4 mr-2" /> Rank All Candidates</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {rankMutation.isPending && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      )}

      {rankMutation.data && !rankMutation.isPending && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">

          {/* Ranked list */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Ranked Candidates</h2>
              <span className="text-xs text-slate-600">{ranked.length} evaluated</span>
            </div>

            <div className="space-y-2">
              {ranked.map((candidate, idx) => {
                const isTop3 = idx < 3;
                const pct = maxScore > 0 ? (candidate.matchResult.finalScore / maxScore) * 100 : 0;
                const resumeCategory = resumes?.find(r => r.id === candidate.resumeId)?.category;
                const dStyle = decisionStyle(candidate.matchResult.decision);

                return (
                  <div
                    key={candidate.resumeId}
                    className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${
                      isTop3
                        ? "border-slate-700 bg-slate-900/80"
                        : "border-slate-800/60 bg-slate-900/30"
                    }`}
                  >
                    <div className="w-10 flex justify-center shrink-0">
                      <RankMedal rank={candidate.rank} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-200">
                          {candidate.label || candidate.resumeId}
                        </span>
                        {resumeCategory && (
                          <span className="text-xs text-slate-500">{resumeCategory}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden max-w-[200px]">
                          <div
                            className={`h-full rounded-full ${
                              idx < 3 ? "bg-primary" : "bg-slate-600"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-400 tabular-nums">
                          {candidate.matchResult.finalScore}
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 ${dStyle}`}
                    >
                      {decisionLabel(candidate.matchResult.decision)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pairwise comparisons */}
          {comparisons.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Top Differentiators
              </h2>
              <div className="space-y-3">
                {comparisons.map((comp, i) => (
                  <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline" className="font-mono text-xs border-slate-700">{comp.candidateA}</Badge>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                      <Badge variant="outline" className="font-mono text-xs border-slate-700">{comp.candidateB}</Badge>
                      <span className="text-xs text-slate-500 ml-auto">Δ {comp.scoreDiff} pts</span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed border-l-2 border-slate-700 pl-3">
                      {comp.keyDifferentiator}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!rankMutation.data && !rankMutation.isPending && (
        <div className="border border-dashed border-slate-800 rounded-xl p-10 text-center">
          <ListOrdered className="w-8 h-8 mx-auto mb-3 text-slate-700" />
          <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
            Select a job profile above to rank all 18 benchmark candidates simultaneously. The engine evaluates each in parallel and surfaces the best fit at the top.
          </p>
        </div>
      )}
    </div>
  );
}
