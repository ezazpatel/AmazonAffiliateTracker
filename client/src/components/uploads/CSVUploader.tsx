import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { parseCSV } from "@/lib/csv-parser";

interface CSVRow {
  primaryKeyword: string;
  scheduledDate: string;
  scheduledTime: string;
  isValid: boolean;
  errors?: string[];
}

export default function CSVUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<CSVRow[]>([]);
  const [validRows, setValidRows] = useState<boolean[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAll, setSelectedAll] = useState(false);
  const { toast } = useToast();

  const upload = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest("POST", "/api/keywords/upload", formData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Successful",
        description: `Successfully processed ${data.count} keywords from ${file?.name}`,
      });
      setFile(null);
      setParsedData([]);
      setValidRows([]);
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsUploading(false);
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

  const handleFile = async (file: File) => {
    if (file.type !== "text/csv") {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }
    
    setFile(file);
    
    try {
      const result = await parseCSV(file);
      setParsedData(result.data);
      setValidRows(result.data.map(() => true));
      setSelectedAll(true);
    } catch (error) {
      toast({
        title: "CSV Parsing Error",
        description: error instanceof Error ? error.message : "Failed to parse CSV file",
        variant: "destructive",
      });
    }
  };

  const handleToggleRow = (index: number) => {
    const newValidRows = [...validRows];
    newValidRows[index] = !newValidRows[index];
    setValidRows(newValidRows);
    setSelectedAll(newValidRows.every(Boolean));
  };

  const handleToggleAll = () => {
    const newSelectedAll = !selectedAll;
    setSelectedAll(newSelectedAll);
    setValidRows(parsedData.map(() => newSelectedAll));
  };

  const handleRemoveFile = () => {
    setFile(null);
    setParsedData([]);
    setValidRows([]);
  };

  const handleSubmit = () => {
    if (!file || parsedData.length === 0) return;
    
    setIsUploading(true);
    
    // Filter selected rows
    const selectedData = parsedData.filter((_, index) => validRows[index]);
    
    if (selectedData.length === 0) {
      toast({
        title: "No Rows Selected",
        description: "Please select at least one row to upload",
        variant: "destructive",
      });
      setIsUploading(false);
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('selectedRows', JSON.stringify(
      selectedData.map(row => ({
        primaryKeyword: row.primaryKeyword,
        scheduledDate: row.scheduledDate,
        scheduledTime: row.scheduledTime
      }))
    ));
    
    upload.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Upload CSV File</CardTitle>
          <CardDescription>
            Upload a CSV file with keywords for content generation. The file should have columns for primary keyword, scheduled date, and scheduled time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!file ? (
            <div 
              className={`border-2 border-dashed ${dragActive ? 'border-primary' : 'border-neutral-200'} 
                        ${dragActive ? 'bg-blue-50' : 'bg-white'} rounded-lg p-10 text-center`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-800 mb-2">Drag and drop your CSV file here</h3>
              <p className="text-neutral-600 mb-4">or</p>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-primary hover:bg-primary-dark text-white font-medium"
              >
                Browse Files
              </Button>
              <p className="text-sm text-neutral-600 mt-6">
                Accepted format: .CSV with columns for keyword, date, and time
              </p>
              <div className="mt-4">
                <p className="text-xs text-neutral-500">Example CSV format:</p>
                <pre className="text-xs text-left bg-neutral-50 p-2 rounded mt-1 inline-block">
                  primary_keyword,scheduled_date,scheduled_time<br/>
                  best kitchen gadgets,2023-08-24,10:30<br/>
                  top fitness trackers,2023-08-25,09:00
                </pre>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleChange}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-neutral-50 p-3 rounded">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-primary mr-3" />
                  <div>
                    <p className="font-medium text-neutral-800">{file.name}</p>
                    <p className="text-xs text-neutral-600">{parsedData.length} rows detected</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRemoveFile}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {parsedData.length > 0 && (
                <div className="border rounded">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox 
                              checked={selectedAll} 
                              onCheckedChange={handleToggleAll} 
                              aria-label="Select all rows"
                            />
                          </TableHead>
                          <TableHead>Primary Keyword</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.map((row, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Checkbox 
                                checked={validRows[index]} 
                                onCheckedChange={() => handleToggleRow(index)}
                                aria-label={`Select row ${index + 1}`}
                                disabled={!row.isValid}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{row.primaryKeyword}</TableCell>
                            <TableCell>{row.scheduledDate}</TableCell>
                            <TableCell>{row.scheduledTime}</TableCell>
                            <TableCell>
                              {row.isValid ? (
                                <span className="flex items-center text-success text-sm">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Valid
                                </span>
                              ) : (
                                <span className="flex items-center text-destructive text-sm" title={row.errors?.join('\n')}>
                                  <AlertCircle className="h-4 w-4 mr-1" />
                                  Invalid
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={handleRemoveFile} disabled={isUploading}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={isUploading || !parsedData.some((_, index) => validRows[index])}
                >
                  {isUploading ? "Processing..." : "Process Selected Rows"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">CSV Format Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-medium mb-2">Required Columns</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>primary_keyword</strong> - The main keyword for content generation
                  <p className="text-sm text-neutral-600">Example: "best gaming laptops under 1000"</p>
                </li>
                <li>
                  <strong>scheduled_date</strong> - The date to publish in YYYY-MM-DD format
                  <p className="text-sm text-neutral-600">Example: "2023-09-15"</p>
                </li>
                <li>
                  <strong>scheduled_time</strong> - The time to publish in HH:MM format (24-hour)
                  <p className="text-sm text-neutral-600">Example: "14:30"</p>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-base font-medium mb-2">Example CSV Content</h3>
              <pre className="text-sm bg-neutral-50 p-3 rounded">
                primary_keyword,scheduled_date,scheduled_time<br/>
                best kitchen gadgets,2023-08-24,10:30<br/>
                top fitness trackers,2023-08-25,09:00<br/>
                smart home devices,2023-08-26,15:45<br/>
                gaming monitors 2023,2023-08-27,12:00
              </pre>
            </div>
            
            <div>
              <h3 className="text-base font-medium mb-2">Tips</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Ensure there are no extra spaces before or after column names and values</li>
                <li>Make sure the date is in the format YYYY-MM-DD</li>
                <li>Make sure the time is in 24-hour format (HH:MM)</li>
                <li>Each keyword should be specific and descriptive for better content generation</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
