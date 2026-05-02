import { Link, useLocation } from "wouter";
import { Briefcase, ListOrdered, BarChart2, ShieldCheck, Activity, Database } from "lucide-react";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Match", icon: Briefcase },
    { href: "/rank", label: "Ranking", icon: ListOrdered },
    { href: "/evaluate", label: "Evaluate", icon: BarChart2 },
    { href: "/reliability", label: "Reliability", icon: ShieldCheck },
    { href: "/stability", label: "Stability", icon: Activity },
    { href: "/dataset", label: "Dataset", icon: Database },
  ];

  return (
    <div className="flex min-h-screen w-full">
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-sidebar-foreground">Decision Engine</h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 p-8 bg-background">
        {children}
      </main>
    </div>
  );
}
