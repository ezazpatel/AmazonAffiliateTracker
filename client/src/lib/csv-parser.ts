import { z } from "zod";

interface CSVRow {
  primaryKeyword: string;
  scheduledDate: string;
  scheduledTime: string;
  isValid: boolean;
  errors?: string[];
}

const csvRowSchema = z.object({
  primary_keyword: z.string().min(1, "Primary keyword is required"),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format")
});

export async function parseCSV(file: File): Promise<{ data: CSVRow[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].toLowerCase().trim().split(',');
        
        if (!headers.includes('primary_keyword') || !headers.includes('scheduled_date') || !headers.includes('scheduled_time')) {
          throw new Error('CSV must include primary_keyword, scheduled_date, and scheduled_time columns');
        }
        
        const data: CSVRow[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = line.split(',');
          const row = {
            primary_keyword: values[headers.indexOf('primary_keyword')]?.trim() || '',
            scheduled_date: values[headers.indexOf('scheduled_date')]?.trim() || '',
            scheduled_time: values[headers.indexOf('scheduled_time')]?.trim() || ''
          };
          
          try {
            csvRowSchema.parse(row);
            data.push({
              primaryKeyword: row.primary_keyword,
              scheduledDate: row.scheduled_date,
              scheduledTime: row.scheduled_time,
              isValid: true
            });
          } catch (error) {
            if (error instanceof z.ZodError) {
              data.push({
                primaryKeyword: row.primary_keyword,
                scheduledDate: row.scheduled_date,
                scheduledTime: row.scheduled_time,
                isValid: false,
                errors: error.errors.map(e => e.message)
              });
            }
          }
        }
        
        resolve({ data });
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to parse CSV'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export async function parseCSV(file: File): Promise<{ data: CSVRow[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        
        if (!text) {
          reject(new Error("Failed to read file"));
          return;
        }
        
        const lines = (text as string).split('\n');
        
        // Check if file is empty
        if (lines.length === 0) {
          reject(new Error("CSV file is empty"));
          return;
        }
        
        // Get headers and validate required columns
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const requiredColumns = ['primary_keyword', 'scheduled_date', 'scheduled_time'];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        
        if (missingColumns.length > 0) {
          reject(new Error(`Missing required columns: ${missingColumns.join(', ')}`));
          return;
        }
        
        // Find column indices
        const keywordIndex = headers.indexOf('primary_keyword');
        const dateIndex = headers.indexOf('scheduled_date');
        const timeIndex = headers.indexOf('scheduled_time');
        
        // Parse data rows
        const data: CSVRow[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Skip empty lines
          if (!line) continue;
          
          const values = line.split(',');
          const errors: string[] = [];
          
          // Get values from correct columns
          const primaryKeyword = values[keywordIndex]?.trim() || '';
          const scheduledDate = values[dateIndex]?.trim() || '';
          const scheduledTime = values[timeIndex]?.trim() || '';
          
          // Validate data
          if (!primaryKeyword) {
            errors.push('Primary keyword is required');
          }
          
          if (!scheduledDate) {
            errors.push('Scheduled date is required');
          } else if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
            errors.push('Scheduled date must be in YYYY-MM-DD format');
          }
          
          if (!scheduledTime) {
            errors.push('Scheduled time is required');
          } else if (!/^\d{2}:\d{2}$/.test(scheduledTime)) {
            errors.push('Scheduled time must be in HH:MM format');
          }
          
          data.push({
            primaryKeyword,
            scheduledDate,
            scheduledTime,
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
          });
        }
        
        resolve({ data });
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Failed to parse CSV"));
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    
    reader.readAsText(file);
  });
}
