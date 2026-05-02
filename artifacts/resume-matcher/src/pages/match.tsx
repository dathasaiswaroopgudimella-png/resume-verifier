import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { useListJobs, useListResumes, useMatchResumeToJob } from "@workspace/api-client-react";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { MatchResult, MatchResultDecision } from "@workspace/api-client-react/src/generated/api.schemas";

const matchSchema = z.object({
  jobId: z.string().optional(),
  jobText: z.string().min(10, "Job description must be at least 10 characters"),
  resumeText: z.string().min(10, "Resume must be at least 10 characters"),
});

type MatchFormValues = z.infer<typeof matchSchema>;

function DecisionBadge({ decision }: { decision: MatchResultDecision }) {
  switch (decision) {
    case "STRONG_FIT": return <Badge className="bg-green-600 hover:bg-green-700 text-white" data-testid="decision-badge">Strong Fit</Badge>;
    case "GOOD_FIT": return <Badge className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="decision-badge">Good Fit</Badge>;
    case "WEAK_FIT": return <Badge className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="decision-badge">Weak Fit</Badge>;
    case "REJECT": return <Badge variant="destructive" data-testid="decision-badge">Reject</Badge>;
    case "INSUFFICIENT_DATA": return <Badge variant="secondary" data-testid="decision-badge">Insufficient Data</Badge>;
    default: return <Badge data-testid="decision-badge">{decision}</Badge>;
  }
}

export default function MatchPage() {
  const { data: jobs, isLoading: isJobsLoading } = useListJobs();
  const { data: resumes, isLoading: isResumesLoading } = useListResumes();
  
  const matchMutation = useMatchResumeToJob();

  const form = useForm<MatchFormValues>({
    resolver: zodResolver(matchSchema),
    defaultValues: {
      jobId: "",
      jobText: "",
      resumeText: "",
    },
  });

  const onSubmit = (values: MatchFormValues) => {
    matchMutation.mutate({ data: { resumeText: values.resumeText, jobText: values.jobText, jobId: values.jobId } });
  };

  const handleLoadJob = (jobId: string) => {
    const job = jobs?.find(j => j.id === jobId);
    if (job) {
      form.setValue("jobText", job.description);
    }
  };

  const handleLoadResume = (resumeId: string) => {
    const resume = resumes?.find(r => r.id === resumeId);
    if (resume) {
      form.setValue("resumeText", resume.preview);
    }
  };

  const result = matchMutation.data;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Resume Analysis Engine</h1>
        <p className="text-muted-foreground">Deep semantic evaluation of candidate fit.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Input Data</CardTitle>
            <CardDescription>Provide job description and candidate resume to analyze.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
                
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <h3 className="font-semibold text-sm">Job Description</h3>
                    {!isJobsLoading && jobs && (
                      <Select onValueChange={handleLoadJob} data-testid="select-sample-job">
                        <SelectTrigger className="w-[200px] h-8 text-xs">
                          <SelectValue placeholder="Load sample job..." />
                        </SelectTrigger>
                        <SelectContent>
                          {jobs.map(job => (
                            <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="jobText"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea 
                            placeholder="Paste full job description here..." 
                            className="h-[200px] resize-none font-mono text-sm"
                            data-testid="input-job-text"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <h3 className="font-semibold text-sm">Candidate Resume</h3>
                    {!isResumesLoading && resumes && (
                      <Select onValueChange={handleLoadResume} data-testid="select-sample-resume">
                        <SelectTrigger className="w-[200px] h-8 text-xs">
                          <SelectValue placeholder="Load sample resume..." />
                        </SelectTrigger>
                        <SelectContent>
                          {resumes.map(resume => (
                            <SelectItem key={resume.id} value={resume.id}>{resume.category} ({resume.id.substring(0,8)})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="resumeText"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea 
                            placeholder="Paste full candidate resume here..." 
                            className="h-[200px] resize-none font-mono text-sm"
                            data-testid="input-resume-text"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="pt-4 mt-auto">
                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg" 
                    disabled={matchMutation.isPending}
                    data-testid="button-analyze"
                  >
                    {matchMutation.isPending ? "Analyzing semantic fit..." : "Analyze Match"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="flex flex-col overflow-hidden bg-slate-900/50 border-slate-800">
          <CardHeader className="border-b border-slate-800 bg-slate-900/80">
            <CardTitle className="text-slate-100">Analysis Results</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            {!result ? (
              <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
                <div className="text-center max-w-sm">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Awaiting inputs. The decision engine will perform semantic analysis and skill extraction.</p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-8 overflow-y-auto">
                
                {/* Header Metrics */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Decision</span>
                      <DecisionBadge decision={result.decision} />
                    </div>
                    <div className="text-sm text-slate-400 mt-2 max-w-md leading-relaxed" data-testid="text-explanation">
                      {result.explanation}
                    </div>
                  </div>
                  
                  <div className="h-32 w-32 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart 
                        cx="50%" cy="50%" 
                        innerRadius="70%" outerRadius="100%" 
                        barSize={10} 
                        data={[{ value: result.finalScore, fill: "hsl(var(--primary))" }]}
                        startAngle={90} endAngle={-270}
                      >
                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                        <RadialBar background={{ fill: "hsl(var(--slate-800))" }} dataKey="value" cornerRadius={10} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-white" data-testid="text-final-score">{result.finalScore}</span>
                      <span className="text-[10px] text-slate-400 uppercase">Score</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 font-medium">Confidence Level</span>
                    <span className="text-slate-200">{(result.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={result.confidence * 100} className="h-1.5" />
                </div>

                <Separator className="bg-slate-800" />

                {/* Sub-scores */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Semantic</span>
                      <span className="text-slate-200 font-mono">{result.semanticScore}</span>
                    </div>
                    <Progress value={result.semanticScore} className="h-1.5 bg-slate-800 [&>div]:bg-blue-500" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Skills</span>
                      <span className="text-slate-200 font-mono">{result.weightedSkillScore}</span>
                    </div>
                    <Progress value={result.weightedSkillScore} className="h-1.5 bg-slate-800 [&>div]:bg-indigo-500" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Experience</span>
                      <span className="text-slate-200 font-mono">{result.experienceScore}</span>
                    </div>
                    <Progress value={result.experienceScore} className="h-1.5 bg-slate-800 [&>div]:bg-violet-500" />
                  </div>
                </div>

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Risk Flags
                    </h4>
                    <div className="space-y-2">
                      {result.warnings.map((w, i) => (
                        <Alert key={i} variant="destructive" className="bg-red-950/20 border-red-900/50 py-2">
                          <AlertTitle className="text-xs font-semibold text-red-400">{w.type.replace(/_/g, ' ')}</AlertTitle>
                          <AlertDescription className="text-xs text-red-200/70">{w.message}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills Breakdown */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Skill Taxonomy Map</h4>
                  
                  <div className="space-y-4">
                    {result.matchedSkills.length > 0 && (
                      <div>
                        <div className="text-xs text-slate-500 mb-2">Verified Matches</div>
                        <div className="flex flex-wrap gap-1.5">
                          {result.matchedSkills.map(s => (
                            <Badge key={`m-${s}`} variant="outline" className="bg-emerald-950/30 text-emerald-400 border-emerald-900/50 hover:bg-emerald-950/50">
                              <CheckCircle className="w-3 h-3 mr-1" /> {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {result.impliedSkills.length > 0 && (
                      <div>
                        <div className="text-xs text-slate-500 mb-2">Semantically Implied</div>
                        <div className="flex flex-wrap gap-1.5">
                          {result.impliedSkills.map(s => (
                            <Badge key={`i-${s}`} variant="outline" className="bg-purple-950/30 text-purple-400 border-purple-900/50 hover:bg-purple-950/50">
                              <Info className="w-3 h-3 mr-1" /> {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.missingSkills.length > 0 && (
                      <div>
                        <div className="text-xs text-slate-500 mb-2">Critical Gaps</div>
                        <div className="flex flex-wrap gap-1.5">
                          {result.missingSkills.map(s => (
                            <Badge key={`x-${s}`} variant="outline" className="bg-red-950/30 text-red-400 border-red-900/50 hover:bg-red-950/50">
                              <XCircle className="w-3 h-3 mr-1" /> {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Penalties */}
                {result.penalties.total > 0 && (
                  <div className="bg-slate-900/80 rounded-md p-4 border border-slate-800">
                    <h4 className="text-xs font-semibold text-slate-400 mb-3 uppercase">Deduction Model</h4>
                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                      <div className="text-slate-500">Domain Mismatch</div>
                      <div className="text-red-400 text-right font-mono">-{result.penalties.domainMismatch}</div>
                      <div className="text-slate-500">Core Skill Deficit</div>
                      <div className="text-red-400 text-right font-mono">-{result.penalties.lowCoreSkillMatch}</div>
                      <div className="text-slate-500">Experience Gap</div>
                      <div className="text-red-400 text-right font-mono">-{result.penalties.experienceGap}</div>
                      <div className="col-span-2 mt-2 pt-2 border-t border-slate-800 flex justify-between font-semibold">
                        <span className="text-slate-400">Total Deduction {result.penalties.damped && "(Damped)"}</span>
                        <span className="text-red-500 font-mono">-{result.penalties.total}</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Activity(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.48 12H2" />
    </svg>
  )
}
