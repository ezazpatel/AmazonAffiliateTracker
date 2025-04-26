
import OpenAI from 'openai';
import { storage } from "../storage";

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

  private async generateDisplayTitle(rawTitle: string): Promise<string> {
    const apiKey = await this.getApiKey();
    const client = new OpenAI({ apiKey });

    const prompt = `You are helping rewrite product titles for a blog.
Given this raw product title, write a shorter, human-friendly title.

!Important Instructions:

- DO NOT mention yourself or the writing process like or how you are following the instructions. Return JUST THE CLEANED UP TITLE.
- Keep the brand if available.
- Keep the quantity if available (e.g., '2-pack').
- Keep the tone neutral and professional, avoid marketing language or promotional words like "best" or "amazing".
- Keep the product type (pager, bell, alarm, button, etc.)
- Mention important features like 'wireless' or 'waterproof' if relevant.
- Make it 60–80 characters
- No promotional words like "best" or "amazing".

Example:
Input: "WiFi Wireless Caregiver Pager Call Button System Emergency Alert System Life Alert Button for Seniors Patient Disabled Elderly 1 Call Button 1 Watch Button 1 Receiver (only Supports 2.4GHz Wi-Fi)"
Output: "WiFi Caregiver Pager with Emergency Alert Button for Seniors"

Here's the input:
"${rawTitle}"`;

    const response = await client.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    return response.choices[0].message.content || rawTitle;
  }

  async generateContent(
    keyword: string,
    post: {
      affiliateLinks?: any[];
      description?: string;
      secondaryKeywords?: string[];
    } = {},
  ): Promise<ArticleContent> {
    try {
      const apiKey = await this.getApiKey();
      const client = new OpenAI({ apiKey });

      // Generate cleaner display titles
      const affiliateLinks = post.affiliateLinks || [];
      for (const product of affiliateLinks) {
        product.cleanedTitle = await this.generateDisplayTitle(product.title);
      }

      const outlinePrompt = `Write a helpful, informative, and engaging blog post about: ${keyword}.

      You will NOT write any article content yet.

      The outline MUST use these exact Amazon products as the main H2 sections, in this order:
      ${affiliateLinks.map((p) => `- ${p.title} (ASIN: ${p.asin})`).join("\n")}

      Each section MUST correspond to one product, maintaining the exact order above.
      Each section in the "outline" array must use the ASIN for 'affiliate_connection' corresponding to that product.

      Instructions:
      ${STYLE_GUIDELINES}
      - Create a strong SEO-friendly title for the post (aim for 60–70 characters) that includes the main keyword(s) naturally.
      - DO NOT include any <h2>, <p>, or HTML tags
      - DO NOT generate the full article — JUST return the outline
      - Create exactly ${affiliateLinks.length} sections, one for each product above, in the same order
      - Add 2-3 relevant subheadings under each product section

      Format your response as JSON:
      {
        "title": "Your Blog Post Title",
        "outline": [
          { 
            "heading": "Section Heading",
            "subheadings": ["Subheading 1", "Subheading 2"],
            "affiliate_connection": "B0DG2KWKCK"
          }
        ]
      }`;

      const outlineResponse = await client.chat.completions.create({
        model: "gpt-4-1106-preview",
        messages: [{ role: "user", content: outlinePrompt }],
        temperature: 0.7,
      });

      const outlineResult = JSON.parse(outlineResponse.choices[0].message.content || "{}");

      const excerptPrompt = `Write a catchy, 1-2 sentence excerpt for a blog post titled "${outlineResult.title}".
        
      Instructions:
      ${STYLE_GUIDELINES}`;

      const excerptResponse = await client.chat.completions.create({
        model: "gpt-4-1106-preview",
        messages: [{ role: "user", content: excerptPrompt }],
        temperature: 0.7,
      });

      const postExcerpt = excerptResponse.choices[0].message.content || "";

      let affiliateLinksHTML = "";
      if (affiliateLinks.length > 0) {
        const validAffiliateLinks = affiliateLinks.filter(
          (link) => link.title && link.affiliateLink,
        );
        if (validAffiliateLinks.length > 0) {
          affiliateLinksHTML =
            `<div class="product-links">\n` +
            `<h2>Our Top Picks for the Year (2025)</h2>\n` +
            `<ul style="list-style: disc; margin-left: 20px;">\n` +
            validAffiliateLinks
              .map(
                (link) =>
                  `  <li><a href="${link.affiliateLink}" target="_blank" rel="nofollow">${link.cleanedTitle || link.title}</a></li>`,
              )
              .join("\n") +
            `\n</ul>\n</div>`;
        }
      }

      const firstHeading = outlineResult.outline?.[0]?.heading ?? "First Section";

      const introPrompt = `Write an engaging introduction for "${outlineResult.title}".
    
      Instructions:
      ${STYLE_GUIDELINES}
      - Natural transition to the first section: "${firstHeading}"
      - End at the previous sentence. Do NOT leave content hanging.
      Format with <p> tags only.`;

      const introResponse = await client.chat.completions.create({
        model: "gpt-4-1106-preview",
        messages: [{ role: "user", content: introPrompt }],
        temperature: 0.7,
      });

      let fullContent = "";
      fullContent += `<h1>${outlineResult.title}</h1>\n\n`;
      fullContent += `<p><strong>${postExcerpt}</strong></p>\n\n`;
      fullContent += `${affiliateLinksHTML}\n\n`;
      fullContent += `${introResponse.choices[0].message.content}\n\n`;

      // Product Sections 
      for (const section of outlineResult.outline || []) {
        const product = affiliateLinks.find(
          (p) => p.asin === section.affiliate_connection,
        );

        if (!product) continue;

        const imageInstruction = product.imageUrl
          ? `- Add this image block at the start of the section:\n  <a href="${product.affiliateLink}" target="_blank" rel="nofollow">\n    <img src="${product.imageUrl}" alt="${product.title}" style="max-width:100%; height:auto;" />\n  </a>`
          : "- Skip the image if none is available";

        const productPrompt = `Write a detailed product review for "${product.title}".

        Use ${product.description} to understand what the product does and what are the features and other details. Then use this information to write the review. Explain how each key feature BENEFITS the reader – don't just list specs

      Provide:
      - Use this heading: <h2><a href="${product.affiliateLink}" target="_blank" rel="nofollow">${product.title}</a></h2>
      - Below heading add: <div class="price-button"><a href="${product.affiliateLink}" target="_blank" rel="nofollow" class="amazon-button">Check Amazon Price</a></div>
      - Never mention checking prices or affiliate links in the content
      - ${imageInstruction}
      - Relevant <h3> sub‑sections
      - Use <ul> for 3‑5 quick‑hit pros

      INSTRUCTIONS:
      ${STYLE_GUIDELINES}
      - Every section MUST include an 'affiliate_connection' from the ASIN list. If a section idea does not relate directly to a product, SKIP it.

      Product facts:
      ASIN: ${product.asin}
      Price: ${product.price ?? "N/A"}
      Key features: ${product.description}

      Subheadings:
      ${section.subheadings.map((sub, i) => `${i + 1}. ${sub}`).join("\n")}`;

        const productResponse = await client.chat.completions.create({
          model: "gpt-4-1106-preview",
          messages: [{ role: "user", content: productPrompt }],
          temperature: 0.7,
        });

        let productContent = productResponse.choices[0].message.content || "";

        // Add price under h2 title if available
        const priceHtml = product.price
          ? `<p><strong>Price:</strong> ${product.price}</p>`
          : "";
        productContent = productContent.replace(
          /(<h2>[\s\S]*?<\/h2>)/,
          `$1\n${priceHtml}`,
        );

        // Clean displayed title
        const cleanedTitle = product.cleanedTitle || product.title;
        productContent = productContent.replace(
          new RegExp(`<h2><a href="${product.affiliateLink}" target="_blank" rel="nofollow">.*?</a></h2>`, "i"),
          `<h2><a href="${product.affiliateLink}" target="_blank" rel="nofollow">${cleanedTitle}</a></h2>`,
        );

        fullContent += `${productContent}\n\n`;
      }

      // Wrap-up Section
      const wrapPrompt = `Write a wrap-up section for the blog post titled "${outlineResult.title}".
      
      Instructions:
      ${STYLE_GUIDELINES}
      - Summarize key insights for the exact products from the product sections
      - Encourage the reader to take action and choose confidently`;

      const wrapResponse = await client.chat.completions.create({
        model: "gpt-4-1106-preview",
        messages: [{ role: "user", content: wrapPrompt }],
        temperature: 0.7,
      });

      fullContent += wrapResponse.choices[0].message.content + "\n\n";

      // FAQ Section
      const faqPrompt = `Write 5 detailed FAQs related to "${outlineResult.title}".
      Each FAQ should use <h3> for the question and <p> for the answer.
      Instructions:
      ${STYLE_GUIDELINES}
      - Format using plain HTML only – no markdown.
      - Begin the response with the required HTML tag (e.g., <h3>) and the actual content, with **no pre‑amble or meta commentary**.`;

      const faqResponse = await client.chat.completions.create({
        model: "gpt-4-1106-preview",
        messages: [{ role: "user", content: faqPrompt }],
        temperature: 0.7,
      });

      fullContent +=
        `<h2>Frequently Asked Questions</h2>\n\n` +
        faqResponse.choices[0].message.content;

      // Clean up formatting
      fullContent = fullContent
        .replace(/<p>\s*<p>/g, "<p>")
        .replace(/<\/ul>\s*<\/ul>/g, "</ul>")
        .replace(/<ul>\s*<ul>/g, "<ul>")
        .replace(/<p>\s*<\/p>/g, "")
        .replace(/\n{3,}/g, "\n\n");

      return {
        title: outlineResult.title,
        snippet: postExcerpt,
        content: fullContent.trim(),
      };

    } catch (error) {
      console.error("GPT content generation failed:", error);
      throw new Error(
        `Failed to generate content: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
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
