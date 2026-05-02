import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle, XCircle, Minus, Loader2, BrainCircuit } from "lucide-react";
import { useListJobs, useListResumes, useMatchResumeToJob } from "@workspace/api-client-react";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import type { MatchResult, MatchResultDecision } from "@workspace/api-client-react";

const matchSchema = z.object({
  jobId: z.string().optional(),
  jobText: z.string().min(10, "Job description must be at least 10 characters"),
  resumeText: z.string().min(10, "Resume must be at least 10 characters"),
});
type MatchFormValues = z.infer<typeof matchSchema>;

const DECISION_CONFIG: Record<MatchResultDecision, {
  label: string;
  sublabel: string;
  bg: string;
  border: string;
  text: string;
  muted: string;
}> = {
  STRONG_FIT: {
    label: "Strong Fit",
    sublabel: "Recommended for interview",
    bg: "bg-emerald-950/50",
    border: "border-emerald-800/60",
    text: "text-emerald-400",
    muted: "text-emerald-600",
  },
  GOOD_FIT: {
    label: "Good Fit",
    sublabel: "Worth considering",
    bg: "bg-blue-950/50",
    border: "border-blue-800/60",
    text: "text-blue-400",
    muted: "text-blue-600",
  },
  WEAK_FIT: {
    label: "Weak Fit",
    sublabel: "Significant gaps identified",
    bg: "bg-amber-950/40",
    border: "border-amber-800/50",
    text: "text-amber-400",
    muted: "text-amber-600",
  },
  REJECT: {
    label: "Reject",
    sublabel: "Does not meet requirements",
    bg: "bg-red-950/40",
    border: "border-red-900/50",
    text: "text-red-400",
    muted: "text-red-600",
  },
  INSUFFICIENT_DATA: {
    label: "Insufficient Data",
    sublabel: "Resume too sparse to evaluate",
    bg: "bg-slate-900/80",
    border: "border-slate-700",
    text: "text-slate-400",
    muted: "text-slate-600",
  },
};

function ScoreGauge({ score }: { score: number }) {
  const color =
    score >= 80 ? "#34d399"
    : score >= 60 ? "#60a5fa"
    : score >= 40 ? "#fbbf24"
    : "#f87171";

  return (
    <div className="relative h-40 w-40 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%" cy="50%"
          innerRadius="68%" outerRadius="100%"
          barSize={10}
          data={[{ value: score, fill: color }]}
          startAngle={90} endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: "#1e293b" }} dataKey="value" cornerRadius={10} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums" style={{ color }} data-testid="text-final-score">
          {score}
        </span>
        <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-200 font-mono tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ResultsPanel({ result }: { result: MatchResult }) {
  const cfg = DECISION_CONFIG[result.decision];

  return (
    <div className="space-y-5">
      {/* Hero: Decision + Score */}
      <div className={`rounded-xl border p-5 ${cfg.bg} ${cfg.border}`}>
        <div className="flex items-center gap-6">
          <ScoreGauge score={result.finalScore} />
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] uppercase tracking-widest font-semibold mb-1 ${cfg.muted}`}>
              Hiring Decision
            </div>
            <div className={`text-3xl font-bold leading-none ${cfg.text}`} data-testid="decision-badge">
              {cfg.label}
            </div>
            <div className={`text-sm mt-1 ${cfg.muted}`}>{cfg.sublabel}</div>

            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Analysis Confidence</span>
                <span className="text-slate-300 font-mono">{(result.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-400 rounded-full"
                  style={{ width: `${result.confidence * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3">
          Signal Breakdown
        </div>
        <ScoreBar label="Semantic Relevance" value={result.semanticScore} colorClass="bg-blue-500" />
        <ScoreBar label="Skill Coverage" value={result.weightedSkillScore} colorClass="bg-indigo-400" />
        <ScoreBar label="Experience Fit" value={result.experienceScore} colorClass="bg-violet-400" />
      </div>

      {/* Explanation */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
          Why this decision
        </div>
        <p className="text-sm text-slate-300 leading-relaxed border-l-2 border-slate-600 pl-3" data-testid="text-explanation">
          {result.explanation}
        </p>
      </div>

      {/* Skills */}
      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
          Skill Analysis
        </div>
        {result.matchedSkills.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-1.5 flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-emerald-500" /> Verified matches
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.matchedSkills.map(s => (
                <Badge key={s} variant="outline" className="bg-emerald-950/30 text-emerald-400 border-emerald-900/50 text-xs">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {result.impliedSkills.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Minus className="w-3 h-3 text-purple-400" /> Semantically implied (0.5× weight)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.impliedSkills.map(s => (
                <Badge key={s} variant="outline" className="bg-purple-950/30 text-purple-400 border-purple-900/50 text-xs border-dashed">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {result.missingSkills.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-1.5 flex items-center gap-1.5">
              <XCircle className="w-3 h-3 text-red-500" /> Critical gaps
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.missingSkills.map(s => (
                <Badge key={s} variant="outline" className="bg-red-950/30 text-red-400 border-red-900/50 text-xs">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {result.matchedSkills.length === 0 && result.impliedSkills.length === 0 && result.missingSkills.length === 0 && (
          <p className="text-xs text-slate-600 italic">No skills extracted — provide a job with required skills for skill analysis.</p>
        )}
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-500" /> Risk flags
          </div>
          {result.warnings.map((w, i) => (
            <div key={i} className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
              <div className="text-xs font-semibold text-amber-400 mb-0.5">{w.type.replace(/_/g, " ")}</div>
              <div className="text-xs text-amber-200/60 leading-relaxed">{w.message}</div>
            </div>
          ))}
        </div>
      )}

      {/* Penalty Model */}
      {result.penalties.total > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3">
            Score Deductions
          </div>
          <div className="space-y-2 text-xs">
            {result.penalties.domainMismatch > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Domain mismatch</span>
                <span className="text-red-400 font-mono">−{result.penalties.domainMismatch}</span>
              </div>
            )}
            {result.penalties.lowCoreSkillMatch > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Core skill deficit</span>
                <span className="text-red-400 font-mono">−{result.penalties.lowCoreSkillMatch}</span>
              </div>
            )}
            {result.penalties.experienceGap > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Experience gap</span>
                <span className="text-red-400 font-mono">−{result.penalties.experienceGap}</span>
              </div>
            )}
            {result.penalties.adversarialStuffing > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Keyword stuffing</span>
                <span className="text-red-400 font-mono">−{result.penalties.adversarialStuffing}</span>
              </div>
            )}
            <Separator className="bg-slate-800 my-1" />
            <div className="flex justify-between font-semibold">
              <span className="text-slate-400">
                Total{result.penalties.damped ? " (damped)" : ""}
              </span>
              <span className="text-red-500 font-mono">−{result.penalties.total}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MatchPage() {
  const { data: jobs, isLoading: isJobsLoading } = useListJobs();
  const { data: resumes, isLoading: isResumesLoading } = useListResumes();
  const matchMutation = useMatchResumeToJob();

  const form = useForm<MatchFormValues>({
    resolver: zodResolver(matchSchema),
    defaultValues: { jobId: "", jobText: "", resumeText: "" },
  });

  const onSubmit = (values: MatchFormValues) => {
    matchMutation.mutate({ data: { resumeText: values.resumeText, jobText: values.jobText, jobId: values.jobId } });
  };

  const handleLoadJob = (jobId: string) => {
    const job = jobs?.find(j => j.id === jobId);
    if (job) form.setValue("jobText", job.description);
  };

  const handleLoadResume = (resumeId: string) => {
    const resume = resumes?.find(r => r.id === resumeId);
    if (resume) form.setValue("resumeText", resume.preview);
  };

  const result = matchMutation.data;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resume Analysis Engine</h1>
        <p className="text-sm text-slate-500 mt-1">
          BM25 semantic scoring · Skill extraction · Experience inference · Adversarial detection
        </p>
      </div>

      {/* Input Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Job */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Job Description</label>
            {!isJobsLoading && jobs && (
              <Select onValueChange={handleLoadJob}>
                <SelectTrigger className="w-[190px] h-7 text-xs border-slate-700 bg-slate-900" data-testid="select-sample-job">
                  <SelectValue placeholder="Load sample…" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="jobText"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Paste the full job description here…"
                        className="h-48 resize-none font-mono text-xs bg-slate-900/60 border-slate-700 placeholder:text-slate-600 focus:border-slate-500"
                        data-testid="input-job-text"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        {/* Resume */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Candidate Resume</label>
            {!isResumesLoading && resumes && (
              <Select onValueChange={handleLoadResume}>
                <SelectTrigger className="w-[190px] h-7 text-xs border-slate-700 bg-slate-900" data-testid="select-sample-resume">
                  <SelectValue placeholder="Load sample…" />
                </SelectTrigger>
                <SelectContent>
                  {resumes.map(r => <SelectItem key={r.id} value={r.id}>{r.id} — {r.category}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="resumeText"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Paste the full candidate resume here…"
                        className="h-48 resize-none font-mono text-xs bg-slate-900/60 border-slate-700 placeholder:text-slate-600 focus:border-slate-500"
                        data-testid="input-resume-text"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
      </div>

      {/* Submit */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={matchMutation.isPending}
            data-testid="button-analyze"
          >
            {matchMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running analysis…
              </>
            ) : (
              <>
                <BrainCircuit className="w-4 h-4 mr-2" />
                Analyze Candidate
              </>
            )}
          </Button>
        </form>
      </Form>

      {/* Results */}
      {result ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Separator className="bg-slate-800 mb-6" />
          <ResultsPanel result={result} />
        </div>
      ) : !matchMutation.isPending ? (
        <div className="border border-dashed border-slate-800 rounded-xl p-10 text-center">
          <BrainCircuit className="w-8 h-8 mx-auto mb-3 text-slate-700" />
          <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
            Paste a job description and resume above, then click Analyze. The engine will compute semantic fit, extract skills, infer experience, and explain its decision.
          </p>
        </div>
      ) : null}
    </div>
  );
}
