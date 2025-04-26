
import OpenAI from 'openai';
import { storage } from '../storage';

interface ArticleContent {
  title: string;
  content: string;
  snippet: string;
}

const STYLE_GUIDELINES = `
- Use varied sentence lengths to mimic human writing - mostly short sentences followed by a long sentence to drive home the point
- The current year is 2025
- Use grade 6 level Canadian English
- Keep a warm, friendly, and conversational tone
- Begin the response with the required HTML tag (e.g., <h2>, <p>) and the actual content, with **no pre‑amble or meta commentary** like 'This post', or 'Here's the review'
- Do NOT use "Hey There" or similar greetings
- Do NOT mention yourself or the writing process
- Never mention checking prices or affiliate links in the content
- Keep emoji usage minimal - only if absolutely necessary
- Include the main keyword naturally - does not have to be exact phrase but needs to meet the search intent of the user`;

export class OpenAIService {
  private async getApiKey(): Promise<string> {
    const envApiKey = process.env.OPENAI_API_KEY;
    if (envApiKey) return envApiKey;

    const settings = await storage.getApiSettings();
    if (!settings?.openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }
    return settings.openaiApiKey;
  }

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
    } = {},
  ): Promise<ArticleContent> {
    try {
      const apiKey = await this.getApiKey();
      const openai = new OpenAI({ apiKey });

      const affiliateLinks = Array.isArray(post.affiliateLinks) ? post.affiliateLinks : [];
      const mainKeywords = post.secondaryKeywords?.length ? post.secondaryKeywords : [keyword];

      // Generate outline
      const outlinePrompt = `Write a helpful, informative, and engaging blog post about: ${mainKeywords.join(", ")}.

      The outline MUST use these exact Amazon products as the main H2 sections, in this order:
      ${affiliateLinks.map((p) => `- ${p.title} (ASIN: ${p.asin})`).join("\n")}

      Instructions:
      ${STYLE_GUIDELINES}`;

      const outlineResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: outlinePrompt }],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4000,
        response_format: { type: "json_object" }
      });

      const outlineResult = JSON.parse(outlineResponse.choices[0].message.content);

      // Generate full content with sections
      const contentPrompt = `Write a detailed article using this outline: ${JSON.stringify(outlineResult)}. 
      
      Include product reviews and follow these instructions:
      ${STYLE_GUIDELINES}`;

      const contentResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: contentPrompt }],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4000
      });

      const fullContent = contentResponse.choices[0].message.content;

      // Generate snippet
      const snippetPrompt = `Write a catchy, 1-2 sentence excerpt for this article title: "${outlineResult.title}"`;
      
      const snippetResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: snippetPrompt }],
        temperature: 0.7,
        max_tokens: 150
      });

      return {
        title: outlineResult.title,
        content: fullContent,
        snippet: snippetResponse.choices[0].message.content.trim()
      };
    } catch (error) {
      console.error("OpenAI content generation failed:", error);
      throw error;
    }
  }
}

export const openaiService = new OpenAIService();
