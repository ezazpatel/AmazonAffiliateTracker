
import { gptService } from "./gpt-service";
import { amazonService } from "./amazon-service";
import { wordpressService } from "./wordpress-service";
import { storage } from "../storage";
import { type Keyword, type InsertArticle } from "@shared/schema";

export class ContentGenerator {
  /**
   * Generate content for a keyword in batch mode
   */
  private async generateBatchContent(keywords: Keyword[]): Promise<void> {
    try {
      const batch = await gptService.createBatch(keywords.map(k => ({
        input: k.primaryKeyword,
        custom_id: k.id.toString()
      })));

      // Update keyword statuses to pending
      await Promise.all(keywords.map(k => 
        storage.updateKeywordStatus(k.id, "pending")
      ));

      // Poll batch status
      const pollInterval = setInterval(async () => {
        const status = await gptService.getBatchStatus(batch.id);
        
        if (status.status === "completed") {
          clearInterval(pollInterval);
          await this.processBatchResults(status);
        }
      }, 60000); // Check every minute

    } catch (error) {
      console.error("Batch content generation failed:", error);
      await Promise.all(keywords.map(k =>
        storage.updateKeywordStatus(k.id, "failed")
      ));
      throw error;
    }
  }

  private async processBatchResults(batchResults: any) {
    for (const result of batchResults.completed) {
      try {
        const keywordId = parseInt(result.custom_id);
        const keyword = await storage.getKeyword(keywordId);
        
        if (!keyword) continue;

        const products = await amazonService.searchProducts(
          keyword.primaryKeyword,
          7
        );

        const articleData: InsertArticle = {
          keywordId: keyword.id,
          title: result.title,
          content: result.content,
          snippet: result.snippet,
          status: "draft",
        };

        const article = await storage.addArticle(articleData);
        await amazonService.addProductsToArticle(article.id, products);
        await storage.updateKeywordStatus(keyword.id, "completed");
        
        await storage.addActivity({
          activityType: "article_generated", 
          message: `Article "${result.title}" generated for "${keyword.primaryKeyword}"`
        });

      } catch (error) {
        console.error(`Failed to process batch result for keyword ${result.custom_id}:`, error);
        await storage.updateKeywordStatus(parseInt(result.custom_id), "failed");
      }
    }
  }

  /**
   * Generate content for a keyword
   * This method orchestrates the full content generation process:
   * 1. Search Amazon for relevant products
   * 2. Generate article content using GPT
   * 3. Save the article and products to storage
   */
  async generateContent(keyword: Keyword): Promise<void> {
    try {
      console.log(
        `[ContentGenerator] Starting content generation for: ${keyword.primaryKeyword}`,
      );

      console.log(
        "[ContentGenerator] Step 1: Searching for Amazon products...",
      );

      const products = await amazonService.searchProducts(
        keyword.primaryKeyword,
        7,
      );

      console.log(
        `[ContentGenerator] Found ${products.length} products:`,
        products.map((p) => ({
          asin: p.asin,
          title: p.title,
          hasImage: !!p.imageUrl,
          hasAffiliate: !!p.affiliateLink,
        })),
      );

      if (products.length === 0) {
        throw new Error("No products found for this keyword");
      }

      console.log(
        "[ContentGenerator] Step 2: Generating article content with GPT...",
      );

      const articleContent = await gptService.generateContent(
        keyword.primaryKeyword,
        { affiliateLinks: products }
      );

      console.log("[ContentGenerator] Step 3: Article content generated:", {
        titleLength: articleContent.title.length,
        contentLength: articleContent.content.length,
        snippetLength: articleContent.snippet?.length,
        hasProductLinks: articleContent.content.includes("product-links"),
        affiliateLinkCount: (
          articleContent.content.match(/href=".*amazon\.com/g) || []
        ).length,
      });

      const articleData: InsertArticle = {
        keywordId: keyword.id,
        title: articleContent.title,
        content: articleContent.content,
        snippet: articleContent.snippet,
        status: "draft",
      };

      const article = await storage.addArticle(articleData);
      await amazonService.addProductsToArticle(article.id, products);
      await storage.updateKeywordStatus(keyword.id, "completed");

      await storage.addActivity({
        activityType: "article_generated",
        message: `Article "${articleContent.title}" generated for "${keyword.primaryKeyword}"`,
      });

      console.log(
        `Content generation completed for: ${keyword.primaryKeyword}`,
      );
    } catch (error) {
      console.error(
        `Content generation failed for ${keyword.primaryKeyword}:`,
        error,
      );

      await storage.updateKeywordStatus(keyword.id, "failed");

      await storage.addActivity({
        activityType: "generation_failed",
        message: `Failed to generate content for "${keyword.primaryKeyword}": ${error instanceof Error ? error.message : "Unknown error"}`,
      });

      throw error;
    }
  }

  /**
   * Schedule a keyword for content generation at the specified date and time
   */
  async scheduleKeywordGeneration(
    keywordId: number,
    date: string,
    time: string,
  ): Promise<void> {
    try {
      const keyword = await storage.getKeyword(keywordId);

      if (!keyword) {
        throw new Error("Keyword not found");
      }

      const scheduledDateTime = new Date(`${date}T${time}`);

      if (scheduledDateTime <= new Date()) {
        await this.generateContent(keyword);
      } else {
        console.log(
          `Keyword ${keywordId} scheduled for generation at ${date} ${time}`,
        );
      }
    } catch (error) {
      console.error(`Failed to schedule keyword ${keywordId}:`, error);
      throw error;
    }
  }
}

export const contentGenerator = new ContentGenerator();
