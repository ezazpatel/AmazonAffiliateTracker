import { amazonService } from "./amazon-service";
import { anthropicService } from "./anthropic-service";
import { storage } from "../storage";
import { type Keyword, type InsertArticle } from "@shared/schema";

export class ContentGenerator {
  /**
   * Generate content for a keyword
   * This method orchestrates the full content generation process:
   * 1. Search Amazon for relevant products
   * 2. Generate article content using Anthropic
   * 3. Save the article and products to storage
   */
  async generateContent(keyword: Keyword): Promise<void> {
    try {
      console.log(`Starting content generation for: ${keyword.primaryKeyword}`);
      
      // Both Amazon API and Anthropic API settings are now first checked from environment variables
      // in their respective services, so we don't need to manually check here.
      // The amazonService and anthropicService will handle the API key validation.
      
      // Step 2: Search Amazon for relevant products
      const products = await amazonService.searchProducts(keyword.primaryKeyword, 5);
      
      if (products.length === 0) {
        throw new Error("No products found for this keyword");
      }
      
      // Step 3: Generate article content using Anthropic
      const articleContent = await anthropicService.generateArticleContent(
        keyword.primaryKeyword,
        products,
        { 
          maxTokens: 4000,
          temperature: 0.7 
        }
      );
      
      // Step 4: Create the article in storage
      const articleData: InsertArticle = {
        keywordId: keyword.id,
        title: articleContent.title,
        content: articleContent.content,
        snippet: articleContent.snippet,
        status: "draft", // Start as draft until scheduled publish time
      };
      
      const article = await storage.addArticle(articleData);
      
      // Step 5: Add the products to the article
      await amazonService.addProductsToArticle(article.id, products);
      
      // Step 6: Update keyword status
      await storage.updateKeywordStatus(keyword.id, "completed");
      
      // Step 7: Log activity
      await storage.addActivity({
        activityType: "article_generated",
        message: `Article "${articleContent.title}" was successfully generated for keyword "${keyword.primaryKeyword}"`,
      });
      
      console.log(`Content generation completed for: ${keyword.primaryKeyword}`);
    } catch (error) {
      console.error(`Content generation failed for ${keyword.primaryKeyword}:`, error);
      
      // Update keyword status to failed
      await storage.updateKeywordStatus(keyword.id, "failed");
      
      // Log the failure
      await storage.addActivity({
        activityType: "generation_failed",
        message: `Failed to generate content for "${keyword.primaryKeyword}": ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      
      // Re-throw the error so the caller can handle it
      throw error;
    }
  }
  
  /**
   * Schedule a keyword for content generation at the specified date and time
   */
  async scheduleKeywordGeneration(keywordId: number, date: string, time: string): Promise<void> {
    try {
      const keyword = await storage.getKeyword(keywordId);
      
      if (!keyword) {
        throw new Error("Keyword not found");
      }
      
      // Calculate the scheduled timestamp
      const scheduledDateTime = new Date(`${date}T${time}`);
      
      // Check if the scheduled time is in the past
      if (scheduledDateTime <= new Date()) {
        // If it's in the past, generate content immediately
        await this.generateContent(keyword);
      } else {
        // Otherwise, the scheduler service will pick it up and process it at the right time
        console.log(`Keyword ${keywordId} scheduled for generation at ${date} ${time}`);
      }
    } catch (error) {
      console.error(`Failed to schedule keyword ${keywordId}:`, error);
      throw error;
    }
  }
}

export const contentGenerator = new ContentGenerator();
