
import OpenAI from 'openai';
import { storage } from "../storage";

interface ArticleContent {
  title: string;
  content: string;
  snippet: string;
}

export class GPTService {
  private async getApiKey(): Promise<string> {
    const envApiKey = process.env.OPENAI_API_KEY;

    if (envApiKey) {
      return envApiKey;
    }

    const settings = await storage.getApiSettings();
    if (!settings || !settings.openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    return settings.openaiApiKey;
  }

  async generateContent(
    keyword: string,
    post: {
      affiliateLinks?: any[];
      description?: string;
      secondaryKeywords?: string[];
    } = {},
  ): Promise<ArticleContent> {
    const apiKey = await this.getApiKey();
    const client = new OpenAI({ apiKey });

    const affiliateLinks = post.affiliateLinks || [];
    const messages = [
      {
        role: "system",
        content: `You are a skilled content writer creating product review articles. 
        Format your response with proper HTML tags for titles (<h1>, <h2>), paragraphs (<p>), and lists (<ul>, <li>).
        Write in a natural, engaging style targeting a grade 6 reading level.`
      },
      {
        role: "user",
        content: `Write a product review article about: ${keyword}
        Include these products in the review:
        ${affiliateLinks.map(p => `- ${p.title} (${p.affiliateLink})`).join('\n')}`
      }
    ];

    const response = await client.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content || "";

    // Extract title and snippet
    const titleMatch = content.match(/<h1>(.*?)<\/h1>/);
    const title = titleMatch ? titleMatch[1] : keyword;
    const snippet = content.substring(0, 160).replace(/<[^>]*>/g, '');

    return {
      title,
      content,
      snippet,
    };
  }

  async createBatch(inputs: Array<{input: string, custom_id: string}>) {
    const apiKey = await this.getApiKey();
    const client = new OpenAI({ apiKey });

    const response = await client.batches.create({
      input_file_id: "placeholder", // You'll need to create and upload the file first
      endpoint: "/v1/chat/completions",
      completion_window: "24h"
    });

    return response;
  }

  async getBatchStatus(batchId: string) {
    const apiKey = await this.getApiKey();
    const client = new OpenAI({ apiKey });

    return await client.batches.retrieve(batchId);
  }
}

export const gptService = new GPTService();
