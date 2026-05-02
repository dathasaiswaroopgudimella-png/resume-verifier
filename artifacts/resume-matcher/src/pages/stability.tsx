import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useListJobs, useListResumes, useRunStabilityTest } from "@workspace/api-client-react";
import { Activity, ArrowRight, Loader2 } from "lucide-react";

const stabilitySchema = z.object({
  jobId: z.string().min(1, "Please select a target job"),
  resumeId: z.string().optional(),
  resumeText: z.string().optional(),
});
type StabilityFormValues = z.infer<typeof stabilitySchema>;

function StabilityBadge({ stability }: { stability: "HIGH" | "MEDIUM" | "LOW" }) {
  const cfg = {
    HIGH:   { cls: "bg-emerald-950/50 text-emerald-400 border-emerald-900", label: "HIGH — Robust" },
    MEDIUM: { cls: "bg-amber-950/50 text-amber-400 border-amber-900",       label: "MEDIUM — Acceptable" },
    LOW:    { cls: "bg-red-950/50 text-red-400 border-red-900",             label: "LOW — Sensitive" },
  }[stability];
  return <Badge className={`text-sm px-4 py-1 border ${cfg.cls}`}>{cfg.label}</Badge>;
}

export default function StabilityPage() {
  const { data: jobs, isLoading: isJobsLoading } = useListJobs();
  const { data: resumes, isLoading: isResumesLoading } = useListResumes();
  const testMutation = useRunStabilityTest();

  const form = useForm<StabilityFormValues>({
    resolver: zodResolver(stabilitySchema),
    defaultValues: { jobId: "", resumeId: "", resumeText: "" },
  });

  const onSubmit = (values: StabilityFormValues) => {
    const job = jobs?.find(j => j.id === values.jobId);
    if (!job) return;
    testMutation.mutate({
      data: {
        jobId: job.id,
        jobText: job.description,
        resumeId: values.resumeId || undefined,
        resumeText: values.resumeText || undefined,
      },
    });
  };

  const handleLoadResume = (resumeId: string) => {
    const resume = resumes?.find(r => r.id === resumeId);
    if (resume) form.setValue("resumeText", resume.preview);
  };

  const result = testMutation.data;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Adversarial Stability Test</h1>
        <p className="text-sm text-slate-500 mt-1">
          Measures score variance when neutral text is appended to a resume — tests robustness against minor formatting or phrasing changes.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-5">Configure Test</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                control={form.control}
                name="jobId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-400">Target Job Profile</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isJobsLoading}>
                      <FormControl>
                        <SelectTrigger className="border-slate-700 bg-slate-900">
                          <SelectValue placeholder="Select job…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {jobs?.map(job => (
                          <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="resumeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-400">Baseline Resume (optional)</FormLabel>
                    <Select
                      onValueChange={(val) => { field.onChange(val); handleLoadResume(val); }}
                      defaultValue={field.value}
                      disabled={isResumesLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="border-slate-700 bg-slate-900">
                          <SelectValue placeholder="Select from dataset…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {resumes?.map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.id} — {r.category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="resumeText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-slate-400">Or paste custom resume text</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste resume content here…"
                      className="h-36 font-mono text-xs bg-slate-900/60 border-slate-700 placeholder:text-slate-600"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={testMutation.isPending}>
              {testMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running perturbations…</>
              ) : (
                <><Activity className="w-4 h-4 mr-2" /> Execute Stability Test</>
              )}
            </Button>
          </form>
        </Form>
      </div>

      {result && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Before / After */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-6">Perturbation Result</h2>

            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex-1 rounded-lg bg-slate-950 border border-slate-800 p-4 text-center">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Original</div>
                <div className="text-4xl font-bold font-mono tabular-nums text-slate-100 mb-2">
                  {result.original.finalScore}
                </div>
                <Badge variant="outline" className="text-xs border-slate-700">{result.original.decision}</Badge>
              </div>

              <div className="flex flex-col items-center gap-1 shrink-0">
                <ArrowRight className="w-6 h-6 text-slate-600" />
                <span className="text-xs text-slate-600">+neutral text</span>
              </div>

              <div className="flex-1 rounded-lg bg-slate-950 border border-slate-800 p-4 text-center">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Modified</div>
                <div className="text-4xl font-bold font-mono tabular-nums text-slate-100 mb-2">
                  {result.modified.finalScore}
                </div>
                <Badge variant="outline" className="text-xs border-slate-700">{result.modified.decision}</Badge>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Modification applied</div>
                <p className="text-sm text-slate-400 border-l-2 border-slate-700 pl-3 leading-relaxed">
                  {result.modification}
                </p>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Analysis</div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {result.analysis}
                </p>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Score Variance</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-100">
                {result.scoreVariance > 0 ? "+" : ""}{result.scoreVariance} pts
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Rank Shift</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-100">
                {result.rankShift} {result.rankShift === 1 ? "position" : "positions"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3">Overall Stability</div>
              <StabilityBadge stability={result.stability} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
