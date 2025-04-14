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

    reader.onload = (event) => {
      try {
        const text = event.target?.result;

        if (!text) {
          reject(new Error("Failed to read file"));
          return;
        }

        // Handle different line break types (CRLF, LF)
        const lines = (text as string).replace(/\r\n/g, '\n').split('\n');

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

          // Handle potential quoted CSV values with commas inside
          const values: string[] = [];
          let inQuotes = false;
          let currentValue = '';
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            
            if (char === '"' && (j === 0 || line[j-1] !== '\\')) {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(currentValue.trim());
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          
          // Push the last value
          values.push(currentValue.trim());
          
          // If we didn't get enough values, try simple split
          if (values.length <= 1) {
            const simpleSplit = line.split(',');
            if (simpleSplit.length > values.length) {
              values.length = 0;
              simpleSplit.forEach(val => values.push(val.trim()));
            }
          }

          const errors: string[] = [];

          // Get values from correct columns
          const primaryKeyword = values[keywordIndex]?.replace(/^"|"$/g, '').trim() || '';
          const scheduledDate = values[dateIndex]?.replace(/^"|"$/g, '').trim() || '';
          const scheduledTime = values[timeIndex]?.replace(/^"|"$/g, '').trim() || '';

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
        console.error("CSV parsing error:", error);
        reject(error instanceof Error ? error : new Error("Failed to parse CSV"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
}