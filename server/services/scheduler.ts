import { storage } from "../storage";
import { contentGenerator } from "./content-generator";
import { type Keyword } from "@shared/schema";

export class Scheduler {
  private schedulerInterval: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private readonly CHECK_INTERVAL_MS = 300000; // Check every 5 minutes
  
  /**
   * Initialize the scheduler
   */
  init(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    
    // Start the scheduler
    this.schedulerInterval = setInterval(() => this.checkSchedules(), this.CHECK_INTERVAL_MS);
    console.log("Content scheduler initialized");
    
    // Run an initial check immediately
    this.checkSchedules();
  }
  
  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log("Content scheduler stopped");
    }
  }
  
  /**
   * Check for scheduled content generation tasks
   */
  private async checkSchedules(): Promise<void> {
    if (this.isProcessing) {
      return; // Prevent overlapping executions
    }
    
    this.isProcessing = true;
    
    try {
      // Get all pending keywords
      const keywords = await this.getPendingKeywords();
      
      if (keywords.length > 0) {
        console.log(`Found ${keywords.length} pending keywords to process`);
      }
      
      // Process each keyword that's due
      for (const keyword of keywords) {
        try {
          // Convert scheduled date and time to a Date object
          const scheduledDate = keyword.scheduledDate; // Format: YYYY-MM-DD
          const scheduledTime = keyword.scheduledTime; // Format: HH:MM
          const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
          
          // Check if it's time to process this keyword
          if (scheduledDateTime <= new Date()) {
            console.log(`Processing scheduled keyword: ${keyword.primaryKeyword}`);
            
            // Update status to processing
            await storage.updateKeywordStatus(keyword.id, "processing");
            
            // Generate content in the background
            contentGenerator.generateContent(keyword)
              .catch(error => {
                console.error(`Error processing scheduled keyword ${keyword.id}:`, error);
              });
          }
        } catch (error) {
          console.error(`Error checking schedule for keyword ${keyword.id}:`, error);
          // Continue with the next keyword even if one fails
        }
      }
    } catch (error) {
      console.error("Error in scheduler check:", error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Get pending keywords that are scheduled for generation
   */
  private async getPendingKeywords(): Promise<Keyword[]> {
    try {
      const { keywords } = await storage.getKeywords(100, 0, "", "pending");
      return keywords;
    } catch (error) {
      console.error("Failed to fetch pending keywords:", error);
      return [];
    }
  }
  
  /**
   * Manually trigger content generation for a specific keyword
   */
  async triggerKeywordGeneration(keywordId: number): Promise<void> {
    try {
      const keyword = await storage.getKeyword(keywordId);
      
      if (!keyword) {
        throw new Error("Keyword not found");
      }
      
      if (keyword.status !== "pending") {
        throw new Error(`Keyword is in ${keyword.status} state and cannot be processed`);
      }
      
      // Update status to processing
      await storage.updateKeywordStatus(keyword.id, "processing");
      
      // Generate content in the background
      contentGenerator.generateContent(keyword)
        .catch(error => {
          console.error(`Error processing keyword ${keywordId}:`, error);
        });
      
    } catch (error) {
      console.error(`Failed to trigger generation for keyword ${keywordId}:`, error);
      throw error;
    }
  }
}

export const scheduler = new Scheduler();
