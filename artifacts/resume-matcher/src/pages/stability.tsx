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
import { useListJobs, useListResumes, useRunStabilityTest } from "@workspace/api-client-react";
import { Activity, ArrowRight, ShieldAlert } from "lucide-react";

const stabilitySchema = z.object({
  jobId: z.string().min(1, "Please select a target job"),
  resumeId: z.string().optional(),
  resumeText: z.string().optional(),
  jobText: z.string().optional()
});

type StabilityFormValues = z.infer<typeof stabilitySchema>;

export default function StabilityPage() {
  const { data: jobs, isLoading: isJobsLoading } = useListJobs();
  const { data: resumes, isLoading: isResumesLoading } = useListResumes();
  
  const testMutation = useRunStabilityTest();

  const form = useForm<StabilityFormValues>({
    resolver: zodResolver(stabilitySchema),
    defaultValues: {
      jobId: "",
      resumeId: "",
      resumeText: "",
    },
  });

  const onSubmit = (values: StabilityFormValues) => {
    const job = jobs?.find(j => j.id === values.jobId);
    if (!job) return;

    testMutation.mutate({ 
      data: { 
        jobId: job.id,
        jobText: job.description,
        resumeId: values.resumeId || undefined,
        resumeText: values.resumeText || undefined
      } 
    });
  };

  const handleLoadResume = (resumeId: string) => {
    const resume = resumes?.find(r => r.id === resumeId);
    if (resume) {
      form.setValue("resumeText", resume.preview);
    }
  };

  const result = testMutation.data;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Adversarial Stability Test</h1>
        <p className="text-muted-foreground">Evaluate engine robustness against formatting changes, keyword stuffing, and prompt injection.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configure Test</CardTitle>
          <CardDescription>Select a baseline pairing. The engine will apply semantic perturbations to test score variance.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="jobId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Job Profile</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isJobsLoading}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select job profile" />
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
                      <FormLabel>Baseline Resume (Optional)</FormLabel>
                      <Select 
                        onValueChange={(val) => {
                          field.onChange(val);
                          handleLoadResume(val);
                        }} 
                        defaultValue={field.value} 
                        disabled={isResumesLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select from dataset" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {resumes?.map(resume => (
                            <SelectItem key={resume.id} value={resume.id}>{resume.category} ({resume.id.substring(0,8)})</SelectItem>
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
                    <FormLabel>Or paste custom resume text</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Paste resume content here..." 
                        className="h-[150px] font-mono text-sm"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                disabled={testMutation.isPending}
                className="w-full md:w-auto"
              >
                <Activity className="w-4 h-4 mr-2" />
                {testMutation.isPending ? "Running Perturbations..." : "Execute Stability Test"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <Card className="col-span-2 bg-slate-900 border-slate-800 text-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-primary" />
                  Perturbation Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="text-center">
                    <div className="text-sm text-slate-400 mb-1 uppercase tracking-wider">Original Score</div>
                    <div className="text-3xl font-bold font-mono">{result.original.finalScore}</div>
                    <Badge variant="outline" className="mt-2 bg-slate-900">{result.original.decision}</Badge>
                  </div>
                  
                  <ArrowRight className="w-8 h-8 text-slate-600" />
                  
                  <div className="text-center">
                    <div className="text-sm text-slate-400 mb-1 uppercase tracking-wider">Modified Score</div>
                    <div className="text-3xl font-bold font-mono">{result.modified.finalScore}</div>
                    <Badge variant="outline" className="mt-2 bg-slate-900">{result.modified.decision}</Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-300">Modification Vector Applied</h4>
                  <p className="text-sm text-slate-400 border-l-2 border-primary/50 pl-3 py-1 bg-slate-900/50">
                    {result.modification}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-300">Engine Analysis</h4>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {result.analysis}
                  </p>
                </div>

              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800 text-white">
              <CardHeader>
                <CardTitle className="text-sm text-slate-400 uppercase tracking-wider">Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="text-sm text-slate-500 mb-1">Score Variance</div>
                  <div className="text-2xl font-mono">
                    {result.scoreVariance > 0 ? '+' : ''}{result.scoreVariance} pts
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Rank Shift Impact</div>
                  <div className="text-xl">{result.rankShift} positions</div>
                </div>
                <div className="pt-4 border-t border-slate-800">
                  <div className="text-sm text-slate-500 mb-2">Overall Stability</div>
                  {result.stability === "HIGH" && <Badge className="bg-emerald-950/50 text-emerald-400 border-emerald-900 text-lg py-1 px-4">HIGH</Badge>}
                  {result.stability === "MEDIUM" && <Badge className="bg-amber-950/50 text-amber-400 border-amber-900 text-lg py-1 px-4">MEDIUM</Badge>}
                  {result.stability === "LOW" && <Badge className="bg-red-950/50 text-red-400 border-red-900 text-lg py-1 px-4">LOW</Badge>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}