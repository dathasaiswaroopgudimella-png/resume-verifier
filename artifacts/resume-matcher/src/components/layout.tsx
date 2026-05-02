import { Link, useLocation } from "wouter";
import { Briefcase, ListOrdered, BarChart2, ShieldCheck, Activity, Database } from "lucide-react";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: "/",            label: "Match",       icon: Briefcase,   desc: "Analyze a candidate" },
  { href: "/rank",        label: "Ranking",     icon: ListOrdered, desc: "Rank all candidates" },
  { href: "/evaluate",    label: "Evaluate",    icon: BarChart2,   desc: "System performance" },
  { href: "/reliability", label: "Reliability", icon: ShieldCheck, desc: "Design charter" },
  { href: "/stability",   label: "Stability",   icon: Activity,    desc: "Perturbation test" },
  { href: "/dataset",     label: "Dataset",     icon: Database,    desc: "Browse benchmark data" },
];

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="w-56 border-r border-slate-800 bg-slate-950 flex flex-col shrink-0">
        {/* Brand */}
        <div className="px-5 py-6 border-b border-slate-800">
          <div className="text-sm font-bold text-slate-100 tracking-tight">Decision Engine</div>
          <div className="text-[10px] text-slate-600 mt-0.5 uppercase tracking-widest">Candidate Evaluation System</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group ${
                  isActive
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-slate-600 group-hover:text-slate-400"}`} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-800">
          <div className="text-[10px] text-slate-700 leading-relaxed">
            BM25 · Skill Extraction<br />
            Adversarial Detection<br />
            Spearman ρ = 0.81
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
