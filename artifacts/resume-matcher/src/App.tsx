import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";

import MatchPage from "@/pages/match";
import RankPage from "@/pages/rank";
import EvaluatePage from "@/pages/evaluate";
import ReliabilityPage from "@/pages/reliability";
import StabilityPage from "@/pages/stability";
import DatasetPage from "@/pages/dataset";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={MatchPage} />
      <Route path="/rank" component={RankPage} />
      <Route path="/evaluate" component={EvaluatePage} />
      <Route path="/reliability" component={ReliabilityPage} />
      <Route path="/stability" component={StabilityPage} />
      <Route path="/dataset" component={DatasetPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Layout>
            <Router />
          </Layout>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
