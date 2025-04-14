import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

export default function QuickUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const upload = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest("POST", "/api/keywords/upload", formData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Successful",
        description: `Successfully uploaded ${data.count} keywords`,
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    
    try {
      await upload.mutateAsync(formData);
      
      // Only reset on success
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      // Error handling is done in mutation callbacks
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-neutral-800">Quick Upload</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center p-6 rounded-lg border-2 border-dashed border-neutral-200">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleChange}
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-primary hover:bg-primary-dark px-6"
            disabled={upload.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            {upload.isPending ? "Uploading..." : "Upload CSV"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}