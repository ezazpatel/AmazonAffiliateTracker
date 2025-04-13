import Anthropic from '@anthropic-ai/sdk';
import { storage } from "../storage";

// Define types for the response
interface ArticleContent {
  title: string;
  content: string;
  snippet: string;
}

interface FAQ {
  question: string;
  answer: string;
}

export class AnthropicService {
  private async getApiKey(): Promise<string> {
    // First try to get the key from environment variables
    const envApiKey = process.env.ANTHROPIC_API_KEY;
    
    if (envApiKey) {
      return envApiKey;
    }
    
    // Fallback to stored settings if env variable is not available
    const settings = await storage.getApiSettings();
    
    if (!settings || !settings.anthropicApiKey) {
      throw new Error("Anthropic API key not configured");
    }
    
    return settings.anthropicApiKey;
  }
  
  /**
   * Safely extracts text content from Anthropic's response
   */
  private extractTextContent(response: any): string {
    try {
      if (!response || !response.content || !response.content.length) {
        throw new Error("Empty response from Anthropic API");
      }
      
      const firstContent = response.content[0];
      
      // Handle different response formats
      if (typeof firstContent === 'string') {
        return firstContent;
      } else if (firstContent && typeof firstContent.text === 'string') {
        return firstContent.text;
      } else if (firstContent && firstContent.type === 'text' && typeof firstContent.text === 'string') {
        return firstContent.text;
      } else {
        // If we can't find the text in expected places, try to stringify the entire response
        const contentStr = JSON.stringify(firstContent);
        if (contentStr && contentStr.length > 0) {
          return contentStr;
        }
      }
      
      throw new Error("Could not extract text from Anthropic API response");
    } catch (error) {
      console.error("Failed to extract text from response:", error);
      throw new Error("Failed to extract text from Anthropic API response");
    }
  }
  
  /**
   * Generate article content using Anthropic API
   */
  async generateArticleContent(
    keyword: string,
    products: any[],
    options: {
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<ArticleContent> {
    try {
      const apiKey = await this.getApiKey();
      
      const anthropic = new Anthropic({
        apiKey,
      });
      
      // Create the system prompt for Anthropic
      const systemPrompt = `You are a professional content writer creating a listicle-style blog post for an Amazon affiliate website.
      Your task is to create SEO-optimized content about "${keyword}" that incorporates the provided products.
      
      The content should have this structure:
      1. A compelling title with the main keyword
      2. A snippet (short description that appears after the title)
      3. A summary section with affiliate disclosure
      4. An introduction that explains the topic
      5. Product sections (one for each product), each with:
         - H2 heading with product name
         - Product description
         - Key features/benefits
         - Who it's best for
      6. A FAQ section with 3-5 relevant questions and answers
      7. A conclusion
      
      Follow these SEO best practices:
      - Use the main keyword in the title, first paragraph, and at least one H2
      - Make content comprehensive, informative, and engaging
      - Focus on solving reader problems and answering questions
      - Ensure content flows naturally and doesn't feel keyword-stuffed
      
      Output the content with proper HTML formatting including <h1>, <h2>, <p>, <ul>, <li> tags.
      For the product images, use this format: <img src="{imageUrl}" alt="{title}" />
      
      The output should have the format:
      === TITLE ===
      [The article title]
      
      === SNIPPET ===
      [The article snippet]
      
      === CONTENT ===
      [The full HTML content]`;
      
      // Create the user prompt with product information
      let userPrompt = `Create a listicle article about "${keyword}" using these products:

      `;
      
      // Add product information
      products.forEach((product, index) => {
        userPrompt += `Product ${index + 1}:
        - Title: ${product.title}
        - ASIN: ${product.asin}
        - Description: ${product.description}
        - Image URL: ${product.imageUrl}
        - Affiliate Link: ${product.affiliateLink}
        
        `;
      });
      
      userPrompt += `Remember to structure the article as specified in the system prompt, with proper HTML formatting.`;
      
      // Make the API call to Anthropic
      // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.7,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt }
        ],
      });
      
      // Extract the content
      const content = this.extractTextContent(response);
      
      // Parse the content to extract title, snippet, and full content
      const titleMatch = content.match(/=== TITLE ===\s*([\s\S]*?)\s*(?:===|$)/);
      const snippetMatch = content.match(/=== SNIPPET ===\s*([\s\S]*?)\s*(?:===|$)/);
      const contentMatch = content.match(/=== CONTENT ===\s*([\s\S]*)/); // Compatible with ES2015+
      
      if (!titleMatch || !snippetMatch || !contentMatch) {
        throw new Error("Failed to parse generated content structure");
      }
      
      return {
        title: titleMatch[1].trim(),
        snippet: snippetMatch[1].trim(),
        content: contentMatch[1].trim(),
      };
    } catch (error) {
      console.error("Anthropic content generation failed:", error);
      throw new Error(`Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Generate FAQs related to a keyword
   */
  async generateFAQs(keyword: string, count: number = 5): Promise<FAQ[]> {
    try {
      const apiKey = await this.getApiKey();
      
      const anthropic = new Anthropic({
        apiKey,
      });
      
      const systemPrompt = `You are an SEO expert generating frequently asked questions related to a specific keyword.
      Generate ${count} relevant, conversational FAQs that people might actually search for.
      Each FAQ should include a question and a comprehensive answer (3-5 sentences).
      Focus on providing valuable information that would help users make purchasing decisions.`;
      
      // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 1500,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          { role: "user", content: `Generate ${count} FAQs for the keyword: "${keyword}". Format as JSON with "question" and "answer" fields.` }
        ],
      });
      
      // Extract the content
      const content = this.extractTextContent(response);
      
      // Extract JSON from the response
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/{[\s\S]*}/) ||
                        content.match(/\[\s*{\s*"question"[\s\S]*}\s*\]/);
      
      if (!jsonMatch) {
        throw new Error("Failed to parse JSON from generated FAQs");
      }
      
      const jsonStr = jsonMatch[0].replace(/```json|```/g, '').trim();
      const faqs = JSON.parse(jsonStr);
      
      return Array.isArray(faqs) ? faqs : [faqs];
    } catch (error) {
      console.error("Anthropic FAQ generation failed:", error);
      throw new Error(`Failed to generate FAQs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const anthropicService = new AnthropicService();
