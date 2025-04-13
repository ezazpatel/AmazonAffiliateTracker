import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Info, AlertTriangle, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { type Activity } from "@shared/schema";

interface ActivityItemProps {
  activity: Activity;
}

function ActivityItem({ activity }: ActivityItemProps) {
  const getIcon = () => {
    switch (activity.activityType) {
      case "article_generated":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "csv_imported":
        return <Info className="h-4 w-4 text-info" />;
      case "api_warning":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "generation_failed":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Info className="h-4 w-4 text-info" />;
    }
  };

  const getTitle = () => {
    switch (activity.activityType) {
      case "article_generated":
        return "Article Generated";
      case "csv_imported":
        return "CSV Imported";
      case "api_warning":
        return "API Warning";
      case "generation_failed":
        return "Generation Failed";
      default:
        return "Activity";
    }
  };

  const getColor = () => {
    switch (activity.activityType) {
      case "article_generated":
        return "bg-success bg-opacity-20";
      case "csv_imported":
        return "bg-info bg-opacity-20";
      case "api_warning":
        return "bg-warning bg-opacity-20";
      case "generation_failed":
        return "bg-destructive bg-opacity-20";
      default:
        return "bg-info bg-opacity-20";
    }
  };

  // Format relative time (e.g., "2h ago")
  const getRelativeTime = (timestamp: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - new Date(timestamp).getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className="flex items-start">
      <div className={`${getColor()} p-2 rounded-full mr-4`}>
        {getIcon()}
      </div>
      <div className="flex-1">
        <div className="flex justify-between">
          <p className="text-sm font-medium text-neutral-800">{getTitle()}</p>
          <span className="text-xs text-neutral-600">
            {getRelativeTime(activity.createdAt)}
          </span>
        </div>
        <p className="text-xs text-neutral-600 mt-1">{activity.message}</p>
      </div>
    </div>
  );
}

export default function RecentActivities() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/activities'],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-neutral-800">Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="flex items-start">
                <Skeleton className="h-8 w-8 rounded-full mr-4" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-neutral-800">Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
            <p className="text-neutral-800 font-medium">Failed to load activities</p>
            <p className="text-neutral-600 text-sm">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activities = data?.activities || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold text-neutral-800">Recent Activities</CardTitle>
        <a href="/activities" className="text-primary hover:text-primary-dark text-sm font-medium">
          View All
        </a>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-center py-6">
              <Info className="h-10 w-10 text-neutral-400 mx-auto mb-2" />
              <p className="text-neutral-600">No recent activities</p>
            </div>
          ) : (
            activities.map((activity: Activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
