import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type Keyword } from "@shared/schema";

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const getColor = () => {
    switch (status) {
      case "pending":
        return "bg-warning/20 text-warning border-warning/20";
      case "processing":
        return "bg-info/20 text-info border-info/20";
      case "completed":
        return "bg-success/20 text-success border-success/20";
      case "failed":
        return "bg-destructive/20 text-destructive border-destructive/20";
      case "draft":
        return "bg-info/20 text-info border-info/20";
      default:
        return "bg-neutral-200 text-neutral-700";
    }
  };

  return (
    <Badge variant="outline" className={`${getColor()} font-normal`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function UpcomingPosts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/keywords/upcoming'],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-neutral-800">Upcoming Scheduled Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider">Keyword</th>
                  <th className="text-left py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider">Time</th>
                  <th className="text-right py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {Array(4).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="py-3"><Skeleton className="h-5 w-40" /></td>
                    <td className="py-3"><Skeleton className="h-5 w-24" /></td>
                    <td className="py-3"><Skeleton className="h-5 w-20" /></td>
                    <td className="py-3 text-right"><Skeleton className="h-5 w-16 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-neutral-800">Upcoming Scheduled Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
            <p className="text-neutral-800 font-medium">Failed to load upcoming posts</p>
            <p className="text-neutral-600 text-sm">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const keywords = data?.keywords || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold text-neutral-800">Upcoming Scheduled Posts</CardTitle>
        <a href="/scheduled-posts" className="text-primary hover:text-primary-dark text-sm font-medium">
          View All
        </a>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="text-left py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider">Keyword</th>
                <th className="text-left py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider">Date</th>
                <th className="text-left py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider">Time</th>
                <th className="text-right py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {keywords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6">
                    <div className="text-center">
                      <Info className="h-10 w-10 text-neutral-400 mx-auto mb-2" />
                      <p className="text-neutral-600">No upcoming posts scheduled</p>
                    </div>
                  </td>
                </tr>
              ) : (
                keywords.map((keyword: Keyword) => (
                  <tr key={keyword.id} className="border-b border-neutral-100">
                    <td className="py-3 text-sm text-neutral-800">{keyword.primaryKeyword}</td>
                    <td className="py-3 text-sm text-neutral-600">{keyword.scheduledDate}</td>
                    <td className="py-3 text-sm text-neutral-600">{keyword.scheduledTime}</td>
                    <td className="py-3 text-right">
                      <StatusBadge status={keyword.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
