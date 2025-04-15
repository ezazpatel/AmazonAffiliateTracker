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
   * Creates an SEO-optimized affiliate article with proper product links and formatting
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
      const systemPrompt = `You are a professional content writer creating a comprehensive, SEO-optimized blog post about "${keyword}" for an Amazon affiliate website.

Write in a casual, friendly tone at a 6-7th grade reading level while naturally incorporating variations of "${keyword}" throughout the content.

The article will be generated in sections. For each section:
- Maintain continuity with previous sections
- Use natural language that flows well
- Include relevant variations of the main keyword where appropriate

Start with:
1. Title & Snippet (100 tokens):
   - Create a compelling H1 title using the main keyword
   - Write a 2-3 sentence snippet that hooks readers

2. Affiliate Links Section (100 tokens):
   Create a structured list of product recommendations:
   <div class="product-links">
   - Best Overall: [Product link]
   - Best Budget Option: [Product link]
   - Best Premium Choice: [Product link]
   - Most User-Friendly: [Product link]
   - Best Value: [Product link]
   </div>

3. Introduction (300 tokens):
   - Define the problem/need
   - Explain why "${keyword}" matters
   - Overview of what readers will learn
   - Mention key selection criteria

4. Product Reviews (400 tokens each):
   Each product section must include:
   - H2 heading with product name (in affiliate link)
   - Product image (in affiliate link)
   - Comprehensive analysis of features and benefits
   - Detailed pros and cons
   - Real-world use cases
   - Technical specifications table
   - Clear value proposition
   - Multiple contextual affiliate links
   - Who this product is perfect for

5. Wrap-up (400 tokens):
   - Summarize key findings
   - Compare products across important criteria
   - Make clear recommendations for different user needs
   - Include a final call to action

6. FAQ Section (800 tokens):
   Create 5 detailed FAQs that:
   - Address common concerns about ${keyword}
   - Compare different features and options
   - Explain technical aspects in simple terms
   - Include product-specific questions
   - Each answer should be 3-4 paragraphs with actionable advice
      
      Follow these SEO best practices:
      - Use the main keyword in the title, first paragraph, and at least one H2
      - Make content comprehensive, informative, and engaging
      - Focus on solving reader problems and answering questions
      - Ensure content flows naturally and doesn't feel keyword-stuffed
      
      Output the content with proper HTML formatting including <h1>, <h2>, <p>, <ul>, <li>, and <table> tags.
      
      IMPORTANT - For product links and images:
      1. Each product image should be wrapped in a link to its affiliate URL using:
         <a href="{affiliateLink}" target="_blank" rel="nofollow"><img src="{imageUrl}" alt="{title}" /></a>
      
      2. Each product heading (H2) should also be wrapped in the affiliate link:
         <a href="{affiliateLink}" target="_blank" rel="nofollow"><h2>Product Name</h2></a>
      
      3. Include at least one text link to each product in its description section using:
         <a href="{affiliateLink}" target="_blank" rel="nofollow">Check price on Amazon</a>
      
      4. For the link list section after the snippet, use:
         <div class="product-links">
           <p>Best for [specific use]: <a href="{affiliateLink}" target="_blank" rel="nofollow">{product title}</a></p>
           <!-- Repeat for each product -->
         </div>
      
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
      
      // Add product information with more detail
      products.forEach((product, index) => {
        userPrompt += `Product ${index + 1}:
        - Title: ${product.title}
        - ASIN: ${product.asin}
        - Description: ${product.description}
        - Image URL: ${product.imageUrl}
        - Affiliate Link: ${product.affiliateLink}
        - Key Features: Get these from the product title and description
        - Best Uses: Suggest based on product features
        - Specifications: Include dimensions, weight, materials, etc. when available
        - Who It's Best For: Identify a specific use case for this product
        
        `;
      });
      
      userPrompt += `Remember to structure the article as specified in the system prompt, with proper HTML formatting.`;
      
      // Make the API call to Anthropic

      // Generate content in sections
      const sections = ['title_snippet', 'affiliate_links', 'introduction', 'product_reviews', 'wrap_up', 'faq'];
      let finalContent = '';
      let currentTitle = '';
      let currentSnippet = '';

      for (const section of sections) {
        const tokenLimit = section === 'introduction' ? 300 :
                         section === 'product_reviews' ? 400 :
                         section === 'wrap_up' ? 400 :
                         section === 'faq' ? 800 : 200;

        const response = await anthropic.messages.create({
          model: "claude-3-5-haiku-latest",
          max_tokens: tokenLimit,
          temperature: 0.7,
          system: systemPrompt,
          messages: [
            { 
              role: "user", 
              content: `${userPrompt}\n\nNow, generate the ${section} section. Use the following content generated so far:\n${finalContent}`
            }
          ],
        });

        const sectionContent = this.extractTextContent(response);
        
        if (section === 'title_snippet') {
          const titleMatch = sectionContent.match(/=== TITLE ===\s*([\s\S]*?)(?:===|$)/i);
          const snippetMatch = sectionContent.match(/=== SNIPPET ===\s*([\s\S]*?)(?:===|$)/i);
          if (titleMatch) currentTitle = titleMatch[1].trim();
          if (snippetMatch) currentSnippet = snippetMatch[1].trim();
        } else {
          finalContent += sectionContent + '\n\n';
        }
      }
      
      // Combine title, snippet and content
      const finalResult = `=== TITLE ===\n${currentTitle}\n\n=== SNIPPET ===\n${currentSnippet}\n\n=== CONTENT ===\n${finalContent}`;
      
      // Parse the combined content
      const titleMatch = finalResult.match(/===\s*TITLE\s*===\s*([\s\S]*?)(?:===\s*|$)/i);
      const snippetMatch = finalResult.match(/===\s*SNIPPET\s*===\s*([\s\S]*?)(?:===\s*|$)/i);
      const contentMatch = finalResult.match(/===\s*CONTENT\s*===\s*([\s\S]*)/i);
      
      if (!titleMatch || !snippetMatch || !contentMatch) {
        console.error("Failed to parse content sections. Raw content:", finalResult);
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
      Generate ${count} relevant, conversational FAQs that people actually search for online.
      
      Each FAQ should:
      - Include a question written in natural language as someone would type in Google
      - Provide a comprehensive answer (3-5 sentences) written at a 6-7th grade reading level
      - Focus on providing valuable information that helps users make purchasing decisions
      - Address common concerns, features, benefits, or comparisons related to ${keyword}
      - Include specific product details when appropriate
      
      Write in a helpful, informative tone that builds trust and establishes expertise.`;
      
      const response = await anthropic.messages.create({
        model: "claude-3-5-haiku-latest",
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
