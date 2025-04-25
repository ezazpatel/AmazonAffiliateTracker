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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
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
  Eye, 
  Download, 
  Search, 
  AlertCircle, 
  FileText,
  CheckCircle,
  Clock,
  Upload
} from "lucide-react";
import { type Article } from "@shared/schema";

export default function GeneratedContent() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const { data, isLoading, error } = useQuery<{
    articles: Article[];
    totalPages: number;
    currentPage: number;
  }>({
    queryKey: [`/api/articles?page=${page}&search=${search}&status=${status}`],
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // The query will automatically refetch with the updated search parameter
  };

  const handleView = (article: Article) => {
    setSelectedArticle(article);
    setIsViewOpen(true);
  };

  const handleDownload = (article: Article) => {
    const element = document.createElement("a");
    const file = new Blob([article.content], { type: "text/html" });
    element.href = URL.createObjectURL(file);
    element.download = `${article.title.replace(/\s+/g, '-').toLowerCase()}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Generated Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
                <Input 
                  type="search" 
                  placeholder="Search articles..." 
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
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
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
              <p className="text-neutral-800 font-medium">Failed to load articles</p>
              <p className="text-neutral-600 text-sm">Please try again later</p>
            </div>
          ) : data?.articles?.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="h-10 w-10 text-neutral-400 mx-auto mb-2" />
              <p className="text-neutral-800 font-medium">No articles found</p>
              <p className="text-neutral-600 text-sm">
                {search 
                  ? "Try adjusting your search terms" 
                  : "Upload keywords to generate content"}
              </p>
            </div>
          ) : (
            <>
              <div className="border rounded overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Keyword</TableHead>
                      <TableHead className="hidden md:table-cell">Created</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.articles?.map((article: Article) => (
                      <TableRow key={article.id}>
                        <TableCell className="font-medium">{article.title}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {article.keywordId}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {new Date(article.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            article.status === "published"
                              ? "bg-success/20 text-success border-success/20"
                              : "bg-info/20 text-info border-info/20"
                          }>
                            {article.status === "published" ? (
                              <CheckCircle className="mr-1 h-3 w-3" />
                            ) : (
                              <Clock className="mr-1 h-3 w-3" />
                            )}
                            {article.status.charAt(0).toUpperCase() + article.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleView(article)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDownload(article)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {article.status !== 'published' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const response = await fetch(`/api/articles/${article.id}/publish`, {
                                      method: 'POST'
                                    });
                                    if (!response.ok) {
                                      throw new Error('Failed to publish');
                                    }
                                    // Refetch the articles list
                                    window.location.reload();
                                  } catch (error) {
                                    console.error('Publish error:', error);
                                    alert('Failed to publish article to WordPress. Please check your WordPress credentials.');
                                  }
                                }}
                              >
                                <Upload className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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

      {/* Article Preview Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedArticle?.title}</DialogTitle>
            <DialogDescription>
              Created on {selectedArticle?.createdAt && new Date(selectedArticle.createdAt).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto mt-4 border rounded p-4">
            <div dangerouslySetInnerHTML={{ __html: selectedArticle?.content || "" }} />
          </div>
          
          <DialogFooter className="mt-4">
            <Button 
              variant="outline" 
              onClick={() => selectedArticle && handleDownload(selectedArticle)}
            >
              <Download className="mr-2 h-4 w-4" />
              Download HTML
            </Button>
            <DialogClose asChild>
              <Button type="button">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
