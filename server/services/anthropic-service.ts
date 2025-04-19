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

  private trimToCompleteSentence(text: string): string {
      if (text.endsWith(".") || text.endsWith("!") || text.endsWith("?")) {
        return text;
      }

      const lastSentenceEnd = Math.max(
        text.lastIndexOf(". "),
        text.lastIndexOf("! "),
        text.lastIndexOf("? "),
      );

      if (lastSentenceEnd > 0) {
        return text.substring(0, lastSentenceEnd + 1);
      }

      const absoluteLastEnd = Math.max(
        text.lastIndexOf("."),
        text.lastIndexOf("!"),
        text.lastIndexOf("?"),
      );

      if (absoluteLastEnd > 0) {
        return text.substring(0, absoluteLastEnd + 1);
      }

      return text.trim();
    }
  
  /**
   * Generate article content using Anthropic API
   * Creates an SEO-optimized affiliate article with proper product links and formatting
   */
  async generateArticleContent(
    keyword: string,
    post: {
      affiliateLinks?: any[];
      description?: string;
      secondaryKeywords?: string[];
    } = {},
    options: {
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<ArticleContent> {
    try {
      const apiKey = await this.getApiKey();
    
      
      // Create the system prompt for Anthropic
      try {
        console.log('[AnthropicService] Starting article generation with:', {
          primaryKeyword: keyword,
          hasSecondaryKeywords: !!post.secondaryKeywords?.length,
          affiliateLinksCount: post?.affiliateLinks?.length || 0
        });

        const keywords = [keyword];
        const secondaryKeywords = post.secondaryKeywords || [];
        const affiliateLinks = Array.isArray(post.affiliateLinks) ? post.affiliateLinks : [];
        const mainKeywords = secondaryKeywords.length > 0 ? secondaryKeywords : keywords;

        const client = new Anthropic({ apiKey });
        const ANTHROPIC_MODEL = "claude-3-5-haiku-latest";

        console.log('[AnthropicService] Step 1: Generating title and outline...');
        console.log('[AnthropicService] Available affiliate products:', affiliateLinks.map(link => ({
          name: link.name,
          asin: link.asin,
          hasValidUrl: !!link.url
        })));   
        const outlinePrompt = `You are a professional SEO blog writer for an Amazon affiliate website.

      Write a helpful and engaging blog post about: ${mainKeywords.join(", ")}.

      Please naturally incorporate these product-related keywords as well: ${keywords.join(", ")}.

      ${
          post.description ? `Additional Context from User:
      ${post.description}` : ""
        }

      Instructions:
      1. Use grade 5-6 level Canadian English
      2. Keep a warm, friendly tone like you're helping a fellow shopper
      3. Do NOT mention yourself or the writing process
      4. Do NOT say “this article” or “this blog”
      5. Create an SEO-friendly title (60–70 characters)
      6. Create a clear outline with 2–3 main sections
      7. Each section should include:
         - One H2 heading that’s relevant
         - 1–2 H3 subheadings underneath
         - Each H2 must represent an affiliate product
         - Each product heading must be a clickable affiliate link
         - Each product image must also be a clickable affiliate link

      Format your response as JSON:
      {
        "title": "Your Blog Post Title",
        "outline": [
          { 
            "heading": "Product Section Title",
            "subheadings": ["Subheading 1", "Subheading 2"],
            "affiliate_connection": "Name of the Amazon product to feature in this section"
          }
        ]
      }`;

        const outlineResponse = await client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 1000,
          temperature: 0.7,
          messages: [{ role: "user", content: outlinePrompt }],
        });

        const outlineText = this.extractTextContent(outlineResponse);
        console.log("Outline response text:", outlineText);

        const outlineJson =
          outlineText.match(/```json\s*([\s\S]*?)\s*```/) ||
          outlineText.match(/{[\s\S]*}/);

        if (!outlineJson) {
          console.error("No JSON found in outline response");
          throw new Error("Failed to extract JSON from outline response");
        }

        let jsonStr = Array.isArray(outlineJson) ? outlineJson[1] || outlineJson[0] : outlineJson;
        jsonStr = jsonStr.replace(/```json|```/g, "").trim();
        jsonStr = jsonStr.replace(/[\u0000-\u001F\u007F]/g, "");

        let outlineResult;
        try {
          outlineResult = JSON.parse(jsonStr);
        } catch (e) {
          console.error("Failed to parse outline JSON:", e, outlineJson);
          outlineResult = {
            title: "Blog Post About " + keywords.join(", "),
            outline: [],
          };
        }

        const excerptPrompt = `In a happy, cheerful, and conversational tone write a catchy, 1-2 sentence excerpt for a blog post titled "${outlineResult.title}" that entices readers to continue reading.`;
        const excerptResponse = await client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 150,
          temperature: 0.7,
          messages: [{ role: "user", content: excerptPrompt }],
        });
        const postExcerpt = this.trimToCompleteSentence(this.extractTextContent(excerptResponse));

        let affiliateLinksHTML = "";
        if (affiliateLinks.length > 0) {
        const validAffiliateLinks = affiliateLinks.filter(link => link.name && link.url);
          if (validAffiliateLinks.length > 0) {
            affiliateLinksHTML = `<div class=\"product-links\">\n` +
              validAffiliateLinks.map(link => `<p><strong>Best for:</strong> <a href=\"${link.url}\" target=\"_blank\" rel=\"nofollow\">${link.name}</a></p>`).join("\n") +
              `\n</div>`;
          }
        }

        const introPrompt = `Write an engaging introduction for "${outlineResult.title}".
      Include:
      - A hook that grabs attention
      - Brief mention of key benefits readers will get
      - Natural transition to the first section: "${outlineResult.outline[0]?.heading || "First Section"}"
      Instructions:
      1. Use grade 5-6 level Canadian English
      2. Keep a cheerful, friendly tone — like you're chatting with a fellow shopper
      3. Make it helpful, warm, and down-to-earth
      4. Keep emoji usage minimal - only if absolutely necessary
      5. Include keywords naturally
      6. Give a clear overview of what readers will learn

      Important: End at the previous sentence. Do NOT leave content hanging.
      Format with <p> tags only.`;

        const introResponse = await client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 500,
          temperature: 0.7,
          messages: [{ role: "user", content: introPrompt }],
        });

        let fullContent = "";
        fullContent += `<h1>${outlineResult.title}</h1>\n\n`;
        fullContent += `<p><strong>${postExcerpt}</strong></p>\n\n`;
        fullContent += `${affiliateLinksHTML}\n\n`;

        let introContent = this.extractTextContent(introResponse);
        introContent = this.trimToCompleteSentence(introContent);
        fullContent += `${introContent}\n\n`;

        // === Product Sections ===
        console.log('[AnthropicService] Starting product sections generation');
        for (const section of outlineResult.outline || []) {
          console.log('[AnthropicService] Processing section:', {
            heading: section.heading,
            subheadingsCount: section.subheadings.length,
            affiliateConnection: section.affiliate_connection
          });
          
          const product = affiliateLinks.find(p => p.name === section.affiliate_connection);
          if (!product) {
            console.warn('[AnthropicService] No matching product found for:', section.affiliate_connection);
            continue;
          }
          
          console.log('[AnthropicService] Found matching product:', {
            title: product.title,
            asin: product.asin,
            hasImage: !!product.imageUrl,
            hasAffiliate: !!product.affiliateLink
          });

          const productPrompt = `Write a 400-token product review for "${product.title}".
      Include:
      - An <h2> tag with the product name, wrapped in a <a> to its affiliate URL
      - A product image wrapped in a <a> tag linking to the same affiliate URL
      - 1–2 <h3> subheadings and content for each
      - Real-world use cases, benefits, or specs as <p> content
      - Use <ul> or <table> if needed for clarity

      Product Details:
      Title: ${product.title}
      ASIN: ${product.asin}
      Description: ${product.description}
      Image URL: ${product.imageUrl}
      Affiliate Link: ${product.affiliateLink}

      Subheadings:
      ${section.subheadings.map((sub, i) => `${i + 1}. ${sub}`).join("\n")}`;

          const productResponse = await client.messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: 400,
            temperature: 0.7,
            messages: [{ role: "user", content: productPrompt }],
          });

          const productContent = this.trimToCompleteSentence(this.extractTextContent(productResponse));
          fullContent += productContent + "\n\n";
        }

        // === Wrap-Up Section ===

        const wrapPrompt = 
          "Write a 400-token wrap-up section for the blog post titled \"" + outlineResult.title + "\".\n" +
          "Instructions:\n" +
          "- Summarize key insights from the product sections\n" +
          "- Highlight which product is best for different types of users\n" +
          "- Encourage the reader to take action and choose confidently\n" +
          "- Keep it in a friendly, helpful tone\n" +
          "Format using <h2> and <p> tags only.";

        const wrapResponse = await client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 400,
          temperature: 0.7,
          messages: [{ role: "user", content: wrapPrompt }],
        });

        const wrapContent = this.trimToCompleteSentence(this.extractTextContent(wrapResponse));
        fullContent += wrapContent + "\n\n";

        // === FAQ Section ===
        const faqPrompt =
  "Write 5 detailed FAQs related to \"" + outlineResult.title + "\".\n" +
  "Each FAQ should use <h3> for the question and <p> tags for the answer.\n" +
  "Example Topics to cover:\n" +
  "- Pricing expectations\n" +
  "- Ease of installation/setup\n" +
  "- Who the product is for\n" +
  "- Strengths vs. limitations\n" +
  "- Comparison with other brands\n" +
  "Format using plain HTML. Avoid any markdown or extra syntax.";


        const faqResponse = await client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 800,
          temperature: 0.7,
          messages: [{ role: "user", content: faqPrompt }],
        });

        const faqContent = this.trimToCompleteSentence(this.extractTextContent(faqResponse));
fullContent += `<h2>Frequently Asked Questions</h2>

` + faqContent;

return {
  title: outlineResult.title,
  snippet: postExcerpt,
  content: fullContent.trim(),
};

        } catch (error) {
          console.error("Anthropic content generation failed:", error);
          throw new Error(`Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      
    } catch (error) {
      console.error("Anthropic FAQ generation failed:", error);
      throw new Error(`Failed to generate FAQs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const anthropicService = new AnthropicService();