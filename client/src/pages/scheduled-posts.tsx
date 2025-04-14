import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { 
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  MoreHorizontal, 
  Eye, 
  AlertCircle, 
  Clock,
  CheckCircle,
  LoaderCircle,
  XCircle 
} from "lucide-react";
import { type Keyword } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

export default function ScheduledPosts() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<{
    keywords: Keyword[];
    totalPages: number;
    currentPage: number;
  }>({
    queryKey: [`/api/keywords?page=${page}&search=${search}&status=${status}`],
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  const generateContent = useMutation({
    mutationFn: async (keywordId: number) => {
      const response = await apiRequest("POST", `/api/keywords/${keywordId}/generate`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Content generation started. This may take a few minutes.",
      });
      // Refetch keywords to update status
      queryClient.invalidateQueries({ queryKey: [`/api/keywords`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // The query will automatically refetch with the updated search parameter
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-warning/20 text-warning border-warning/20">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="bg-info/20 text-info border-info/20">
            <LoaderCircle className="mr-1 h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-success/20 text-success border-success/20">
            <CheckCircle className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/20">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-neutral-200 text-neutral-700">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Scheduled Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
                <Input 
                  type="search" 
                  placeholder="Search keywords..." 
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </form>
            <Select 
              value={status} 
              onValueChange={setStatus}
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="py-2">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
              <p className="text-neutral-800 font-medium">Failed to load scheduled posts</p>
              <p className="text-neutral-600 text-sm">Please try again later</p>
            </div>
          ) : data?.keywords?.length === 0 ? (
            <div className="text-center py-10">
              <Clock className="h-10 w-10 text-neutral-400 mx-auto mb-2" />
              <p className="text-neutral-800 font-medium">No scheduled posts found</p>
              <p className="text-neutral-600 text-sm">
                {search 
                  ? "Try adjusting your search terms" 
                  : "Upload keywords to schedule posts"}
              </p>
            </div>
          ) : (
            <>
              <div className="border rounded overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.keywords?.map((keyword: Keyword) => (
                      <TableRow key={keyword.id}>
                        <TableCell className="font-medium">
                          {keyword.primaryKeyword}
                        </TableCell>
                        <TableCell>{keyword.scheduledDate}</TableCell>
                        <TableCell>{keyword.scheduledTime}</TableCell>
                        <TableCell>{getStatusBadge(keyword.status)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {keyword.status === "pending" && (
                                <DropdownMenuItem
                                  onClick={() => generateContent.mutate(keyword.id)}
                                  disabled={generateContent.isPending}
                                >
                                  {generateContent.isPending 
                                    ? "Generating..." 
                                    : "Generate Now"}
                                </DropdownMenuItem>
                              )}
                              {keyword.status === "completed" && (
                                <DropdownMenuItem>
                                  <a href={`/generated-content?keywordId=${keyword.id}`}>
                                    View Content
                                  </a>
                                </DropdownMenuItem>
                              )}
                              {keyword.status === "failed" && (
                                <DropdownMenuItem 
                                  onClick={() => generateContent.mutate(keyword.id)}
                                  disabled={generateContent.isPending}
                                >
                                  Retry Generation
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault();
                          if (page > 1) setPage(page - 1);
                        }}
                        className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    
                    {[...Array(data?.totalPages || 1)].map((_, i) => (
                      <PaginationItem key={i}>
                        <PaginationLink 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(i + 1);
                          }}
                          isActive={page === i + 1}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault();
                          if (page < (data?.totalPages || 1)) setPage(page + 1);
                        }}
                        className={page >= (data?.totalPages || 1) ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
