import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertKeywordSchema, insertApiSettingsSchema } from "@shared/schema";
import multer from "multer";
import csvParser from "csv-parser";
import { Readable } from "stream";
import { contentGenerator } from "./services/content-generator";
import { scheduler } from "./services/scheduler";

// Set up multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize the scheduler
  scheduler.init();

  // API Routes
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const totalArticles = await storage.countArticles();
      const scheduledPosts = await storage.countPendingKeywords();
      const affiliateLinks = await storage.countProducts();
      const apiCredits = 1000; // This would be fetched from API provider in a real app

      res.json({
        stats: {
          totalArticles,
          scheduledPosts,
          affiliateLinks,
          apiCredits,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Activities
  app.get("/api/activities", async (req, res) => {
    try {
      const activities = await storage.getActivities(10);
      res.json({ activities });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // Keywords
  app.get("/api/keywords", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const search = (req.query.search as string) || "";
      const status = (req.query.status as string) || "all";
      
      const limit = 10;
      const offset = (page - 1) * limit;
      
      const { keywords, total } = await storage.getKeywords(limit, offset, search, status);
      const totalPages = Math.ceil(total / limit);
      
      res.json({ keywords, totalPages, currentPage: page });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch keywords" });
    }
  });

  app.get("/api/keywords/upcoming", async (req, res) => {
    try {
      const keywords = await storage.getUpcomingKeywords();
      res.json({ keywords });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch upcoming keywords" });
    }
  });

  app.post("/api/keywords/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Check if selectedRows is provided
      const selectedRowsJSON = req.body.selectedRows;
      let selectedRows = [];
      
      if (selectedRowsJSON) {
        try {
          selectedRows = JSON.parse(selectedRowsJSON);
        } catch (error) {
          return res.status(400).json({ message: "Invalid selected rows format" });
        }
      } else {
        // If no selected rows, parse the entire CSV
        const fileBuffer = req.file.buffer;
        const results: any[] = [];
        
        await new Promise<void>((resolve, reject) => {
          Readable.from(fileBuffer)
            .pipe(csvParser())
            .on("data", (data) => {
              // Map CSV column names to our schema
              const row = {
                primaryKeyword: data.primary_keyword,
                scheduledDate: data.scheduled_date,
                scheduledTime: data.scheduled_time,
              };
              results.push(row);
            })
            .on("end", () => resolve())
            .on("error", (error) => reject(error));
        });
        
        selectedRows = results;
      }
      
      // Validate each row
      const validRows = [];
      
      for (const row of selectedRows) {
        try {
          const validatedRow = insertKeywordSchema.parse(row);
          validRows.push(validatedRow);
        } catch (error) {
          // Skip invalid rows
        }
      }
      
      if (validRows.length === 0) {
        return res.status(400).json({ message: "No valid rows found in the uploaded file" });
      }
      
      // Save keywords to storage
      await storage.addKeywords(validRows);
      
      // Log activity
      await storage.addActivity({
        activityType: "csv_imported",
        message: `Successfully imported ${validRows.length} keywords from CSV`,
      });
      
      res.json({ success: true, count: validRows.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to process CSV file" });
    }
  });

  app.post("/api/keywords/:id/generate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid keyword ID" });
      }
      
      const keyword = await storage.getKeyword(id);
      if (!keyword) {
        return res.status(404).json({ message: "Keyword not found" });
      }
      
      // Update keyword status to processing
      await storage.updateKeywordStatus(id, "processing");
      
      // Start content generation in the background
      contentGenerator.generateContent(keyword)
        .then(() => {
          // Content generation succeeded
          storage.updateKeywordStatus(id, "completed");
          storage.addActivity({
            activityType: "article_generated",
            message: `Article for "${keyword.primaryKeyword}" was successfully generated`,
          });
        })
        .catch((error) => {
          // Content generation failed
          storage.updateKeywordStatus(id, "failed");
          storage.addActivity({
            activityType: "generation_failed",
            message: `Failed to generate article for "${keyword.primaryKeyword}": ${error.message}`,
          });
        });
      
      res.json({ success: true, message: "Content generation started" });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate content" });
    }
  });

  // Articles
  app.get("/api/articles", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const search = (req.query.search as string) || "";
      const status = (req.query.status as string) || "all";
      const keywordId = req.query.keywordId ? parseInt(req.query.keywordId as string) : undefined;
      
      const limit = 10;
      const offset = (page - 1) * limit;
      
      const { articles, total } = await storage.getArticles(limit, offset, search, status, keywordId);
      const totalPages = Math.ceil(total / limit);
      
      res.json({ articles, totalPages, currentPage: page });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch articles" });
    }
  });

  // API Settings
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getApiSettings();
      res.json({ settings });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch API settings" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const settingsData = insertApiSettingsSchema.parse(req.body);
      await storage.saveApiSettings(settingsData);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid settings data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save API settings" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
