import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AppLayout from "@/layouts/AppLayout";
import Dashboard from "@/pages/dashboard";
import CsvUploader from "@/pages/csv-uploader";
import GeneratedContent from "@/pages/generated-content";
import ScheduledPosts from "@/pages/scheduled-posts";
import ApiSettings from "@/pages/api-settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/csv-uploader" component={CsvUploader} />
      <Route path="/generated-content" component={GeneratedContent} />
      <Route path="/scheduled-posts" component={ScheduledPosts} />
      <Route path="/api-settings" component={ApiSettings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout>
        <Router />
      </AppLayout>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
