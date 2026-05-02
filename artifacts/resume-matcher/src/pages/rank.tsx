import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useListJobs, useListResumes, useRankCandidates } from "@workspace/api-client-react";
import type { MatchResultDecision } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, ChevronRight, Scale } from "lucide-react";

function DecisionBadge({ decision }: { decision: MatchResultDecision }) {
  switch (decision) {
    case "STRONG_FIT": return <Badge className="bg-green-600 hover:bg-green-700 text-white">Strong Fit</Badge>;
    case "GOOD_FIT": return <Badge className="bg-blue-600 hover:bg-blue-700 text-white">Good Fit</Badge>;
    case "WEAK_FIT": return <Badge className="bg-amber-600 hover:bg-amber-700 text-white">Weak Fit</Badge>;
    case "REJECT": return <Badge variant="destructive">Reject</Badge>;
    case "INSUFFICIENT_DATA": return <Badge variant="secondary">Insufficient Data</Badge>;
    default: return <Badge>{decision}</Badge>;
  }
}

export default function RankPage() {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  
  const { data: jobs, isLoading: isJobsLoading } = useListJobs();
  const { data: resumes, isLoading: isResumesLoading } = useListResumes();
  
  const rankMutation = useRankCandidates();

  const handleRank = () => {
    if (!selectedJobId) return;
    const job = jobs?.find(j => j.id === selectedJobId);
    if (!job) return;

    rankMutation.mutate({ 
      data: { 
        jobText: job.description,
        jobId: job.id,
      } 
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Candidate Ranking</h1>
        <p className="text-muted-foreground">Bulk process and rank candidates against a target profile.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ranking Execution</CardTitle>
          <CardDescription>Select a target profile to rank all available candidates in the dataset.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2 flex-1">
              <label className="text-sm font-medium">Target Job Profile</label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId} disabled={isJobsLoading}>
                <SelectTrigger data-testid="select-job">
                  <SelectValue placeholder="Select a job to rank against..." />
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
              {rankMutation.isPending ? "Ranking..." : "Rank Candidates"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {rankMutation.isPending && (
        <div className="space-y-4 mt-8">
          <Skeleton className="h-[400px] w-full rounded-xl" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </div>
      )}

      {rankMutation.data && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="bg-slate-900 border-slate-800 text-slate-100 overflow-hidden">
            <CardHeader className="bg-slate-950 border-b border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Ranked Candidates</CardTitle>
              <Badge variant="outline" className="border-slate-700 text-slate-300">
                {rankMutation.data.ranked.length} evaluated
              </Badge>
            </CardHeader>
            <Table>
              <TableHeader className="bg-slate-900">
                <TableRow className="border-slate-800 hover:bg-slate-900">
                  <TableHead className="w-16 text-center text-slate-400">Rank</TableHead>
                  <TableHead className="text-slate-400">Candidate Profile</TableHead>
                  <TableHead className="text-slate-400">Category</TableHead>
                  <TableHead className="text-slate-400 w-48">Score</TableHead>
                  <TableHead className="text-slate-400">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankMutation.data.ranked.map((candidate, idx) => {
                  const isTop3 = idx < 3;
                  return (
                    <TableRow 
                      key={candidate.resumeId} 
                      className={`border-slate-800 hover:bg-slate-800/50 ${isTop3 ? 'bg-slate-800/20' : ''}`}
                    >
                      <TableCell className="text-center font-mono">
                        {isTop3 ? (
                          <div className="flex items-center justify-center text-amber-400">
                            <Trophy className="w-4 h-4 mr-1" /> {candidate.rank}
                          </div>
                        ) : (
                          <span className="text-slate-500">{candidate.rank}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-slate-200">
                        {candidate.resumeId.substring(0, 8)}...
                        <div className="text-xs text-slate-500 font-normal mt-1">{candidate.label || "Dataset Resume"}</div>
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {resumes?.find(r => r.id === candidate.resumeId)?.category || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm w-8 text-right text-slate-200">
                            {candidate.matchResult.finalScore}
                          </span>
                          <Progress 
                            value={candidate.matchResult.finalScore} 
                            className="h-2 w-24 bg-slate-800"
                            // Custom colored progress bar via style
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <DecisionBadge decision={candidate.matchResult.decision} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {rankMutation.data.pairwiseComparisons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-muted-foreground" />
                  Top Pairwise Differentiators
                </CardTitle>
                <CardDescription>Key reasons why higher ranked candidates outperformed lower ones</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {rankMutation.data.pairwiseComparisons.map((comp, i) => (
                  <div key={i} className="flex flex-col gap-2 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border">
                    <div className="flex items-center gap-4 text-sm font-medium">
                      <Badge variant="outline" className="font-mono bg-background">{comp.candidateA.substring(0,6)}</Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="outline" className="font-mono bg-background">{comp.candidateB.substring(0,6)}</Badge>
                      <span className="text-muted-foreground ml-auto">Δ {comp.scoreDiff} pts</span>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed border-l-2 border-primary/50 pl-3 py-1">
                      {comp.keyDifferentiator}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}