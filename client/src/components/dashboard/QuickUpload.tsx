import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

export default function QuickUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();

  const upload = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest("POST", "/api/keywords/upload", formData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Successful",
        description: `Successfully uploaded ${data.count} keywords from ${file?.name}`,
      });
      setFile(null);
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      handleFile(droppedFile);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type !== "text/csv") {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }
    setFile(file);
  };

  const handleSubmit = () => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    upload.mutate(formData);
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-neutral-800">Quick Upload</CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          className={`border-2 border-dashed ${dragActive ? 'border-primary' : 'border-neutral-200'} 
                    ${dragActive ? 'bg-blue-50' : 'bg-white'} rounded-lg p-8 text-center`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          {file ? (
            <div className="flex flex-col items-center">
              <CheckCircle className="h-12 w-12 text-success mb-2" />
              <p className="text-neutral-800 font-medium mb-1">{file.name}</p>
              <p className="text-neutral-600 mb-4">Ready to upload</p>
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setFile(null)}
                  disabled={upload.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={upload.isPending}
                >
                  {upload.isPending ? "Uploading..." : "Upload File"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 text-neutral-400 mx-auto mb-2" />
              <p className="text-neutral-600 mb-4">Drag and drop your CSV file here or</p>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-primary hover:bg-primary-dark text-white font-medium"
              >
                Browse Files
              </Button>
              <p className="text-xs text-neutral-600 mt-4">
                Accepted format: .CSV with columns for keyword, date, and time
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleChange}
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
