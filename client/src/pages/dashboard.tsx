import { useQuery } from "@tanstack/react-query";
import { Newspaper, FileText, Clock, Coins } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import RecentActivities from "@/components/dashboard/RecentActivities";
import UpcomingPosts from "@/components/dashboard/UpcomingPosts";
import ProcessFlow from "@/components/dashboard/ProcessFlow";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/dashboard/stats'],
  });

  const wpConnection = useQuery({
    queryKey: ['wordpress-connection'],
    queryFn: async () => {
      const response = await fetch('/api/wordpress/test');
      return response.json();
    }
  });

  // Show WordPress connection status alert if there's an issue
  if (wpConnection.data && !wpConnection.data.success) {
    return (
      <Alert variant="destructive" className="mb-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>WordPress Connection Error</AlertTitle>
        <AlertDescription>
          {wpConnection.data.message}. Please check your WordPress credentials in environment variables.
        </AlertDescription>
      </Alert>
    );
  }

  let statCards;

  if (isLoading) {
    statCards = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-12 w-12 rounded-full" />
            </div>
            <div className="flex items-center mt-4">
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (error) {
    statCards = (
      <Alert variant="destructive" className="mb-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load dashboard statistics. Please try again later.
        </AlertDescription>
      </Alert>
    );
  } else {
    const stats = data?.stats || {
      totalArticles: 0,
      scheduledPosts: 0,
      affiliateLinks: 0,
      apiCredits: 0,
    };

    statCards = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Articles"
          value={stats.totalArticles}
          icon={Newspaper}
          change={{
            value: "12%",
            isPositive: true,
            text: "from last month"
          }}
          color="primary"
        />
        <StatCard
          title="Scheduled Posts"
          value={stats.scheduledPosts}
          icon={Clock}
          change={{
            value: "5%",
            isPositive: true,
            text: "from last week"
          }}
          color="accent"
        />
        <StatCard
          title="Affiliate Links"
          value={stats.affiliateLinks}
          icon={FileText}
          change={{
            value: "18%",
            isPositive: true,
            text: "from last month"
          }}
          color="secondary"
        />
        <StatCard
          title="API Credits"
          value={stats.apiCredits}
          icon={Coins}
          change={{
            value: "7%",
            isPositive: false,
            text: "from last week"
          }}
          color="destructive"
        />
      </div>
    );
  }

  return (
    <>
      {/* Overview Stats */}
      {statCards}

      {/* Recent Activities and Upcoming Posts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <RecentActivities />
        <UpcomingPosts />
      </div>

      {/* Process Flow */}
      <ProcessFlow />
    </>
  );
}
