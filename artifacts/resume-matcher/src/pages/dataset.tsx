import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListResumes, useListSkills } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DatasetPage() {
  const { data: resumes, isLoading: isResumesLoading } = useListResumes();
  const { data: skills, isLoading: isSkillsLoading } = useListSkills();

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dataset Explorer</h1>
        <p className="text-muted-foreground">View the benchmark resumes and skill taxonomy underlying the engine.</p>
      </div>

      <Tabs defaultValue="resumes" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="resumes">Evaluation Resumes</TabsTrigger>
          <TabsTrigger value="skills">Skill Taxonomy</TabsTrigger>
        </TabsList>
        
        <TabsContent value="resumes" className="space-y-4">
          {isResumesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resumes?.map(resume => (
                <Card key={resume.id} className="flex flex-col h-full bg-card hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg font-mono text-primary">{resume.id.substring(0,8)}</CardTitle>
                      {resume.syntheticType && (
                        <Badge 
                          variant="outline" 
                          className={
                            resume.syntheticType === "keyword_stuffed" ? "border-red-500/50 text-red-500 bg-red-500/10" :
                            resume.syntheticType === "hidden_skills" ? "border-purple-500/50 text-purple-500 bg-purple-500/10" :
                            resume.syntheticType === "domain_mismatch" ? "border-orange-500/50 text-orange-500 bg-orange-500/10" :
                            "border-slate-500/50 text-slate-500 bg-slate-500/10"
                          }
                        >
                          {resume.syntheticType.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <span className="font-medium text-foreground">{resume.category}</span>
                      <span className="text-muted-foreground text-xs">• {resume.experienceYears}y exp</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 text-sm text-muted-foreground">
                    <div className="bg-muted/50 p-3 rounded-md border border-border h-[120px] overflow-hidden text-xs font-mono leading-relaxed relative">
                      {resume.preview}
                      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted/50 to-transparent" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="skills">
          <Card>
            <CardHeader>
              <CardTitle>Core Taxonomy Maps</CardTitle>
              <CardDescription>Canonical skills and their semantic equivalences</CardDescription>
            </CardHeader>
            <CardContent>
              {isSkillsLoading ? (
                <Skeleton className="h-[500px] w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Canonical Skill</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Synonyms / Implicit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skills?.map((skill, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-semibold text-primary">{skill.canonical}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800">{skill.domain}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">{skill.weight.toFixed(1)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {skill.synonyms.map((s, i) => (
                              <Badge key={i} variant="outline" className="text-xs text-muted-foreground">{s}</Badge>
                            ))}
                            {skill.implicitPhrases.map((s, i) => (
                              <Badge key={`imp-${i}`} variant="outline" className="text-xs border-dashed text-muted-foreground border-muted-foreground/30">{s}</Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}