import Anthropic from "@anthropic-ai/sdk";
import { storage } from "../storage";

// Define types for the response
interface ArticleContent {
  title: string;
  content: string;
  snippet: string;
}

const STYLE_GUIDELINES = `
- Use varied sentence lengths to mimic human writing - mostly short sentences followed by a long sentence to drive home the point
- Use grade 6 level Canadian English
- Keep a warm, friendly, and conversational tone
- Begin the response with the required HTML tag (e.g., <h2>, <p>) and the actual content, with **no pre‑amble or meta commentary** like 'This post', or 'Here's the review'
- Do NOT use "Hey There" or similar greetings
- Do NOT mention yourself or the writing process
- Keep emoji usage minimal - only if absolutely necessary
- Include the main keyword naturally - does not have to be exact phrase but needs to meet the search intent of the user`;

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
      // Log the response structure for debugging
      console.log(
        "[AnthropicService] Raw response structure:",
        JSON.stringify(response, null, 2),
      );

      if (!response) {
        throw new Error("Empty response from Anthropic API");
      }

      // Handle Claude API v1 format
      if (response.completion) {
        return response.completion;
      }

      // Handle Claude API v2/v3 format
      if (response.content && Array.isArray(response.content)) {
        const textContent = response.content
          .filter((item: any) => item && item.type === "text")
          .map((item: any) => item.text)
          .join(" ");

        if (textContent) {
          return textContent;
        }
      }

      // If direct text is available
      if (typeof response.text === "string") {
        return response.text;
      }

      // Last resort: stringify the entire response
      const contentStr = JSON.stringify(response);
      if (contentStr && contentStr !== "{}" && contentStr !== "[]") {
        return contentStr;
      }

      throw new Error("Could not extract text from Anthropic API response");
    } catch (error) {
      console.error("Failed to extract text from response:", error);
      console.error("Response was:", response);
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
    } = {},
  ): Promise<ArticleContent> {
    try {
      const apiKey = await this.getApiKey();

      // Create the system prompt for Anthropic
      try {
        console.log("[AnthropicService] Starting article generation with:", {
          primaryKeyword: keyword,
          hasSecondaryKeywords: !!post.secondaryKeywords?.length,
          affiliateLinksCount: post?.affiliateLinks?.length || 0,
        });

        const keywords = [keyword];
        const secondaryKeywords = post.secondaryKeywords || [];
        const affiliateLinks = Array.isArray(post.affiliateLinks)
          ? post.affiliateLinks
          : [];
        const mainKeywords =
          secondaryKeywords.length > 0 ? secondaryKeywords : keywords;

        const client = new Anthropic({ apiKey });
        const ANTHROPIC_MODEL = "claude-3-5-haiku-latest";

        console.log(
          "[AnthropicService] Step 1: Generating title and outline...",
        );
        console.log(
          "[AnthropicService] Available affiliate products:",
          affiliateLinks.map((link) => ({
            name: link.title,
            asin: link.asin,
            hasValidUrl: !!link.affiliateLink,
          })),
        );
        const outlinePrompt = `Write a helpful, informative, and engaging blog post about: ${mainKeywords.join(", ")}.

        You will NOT write any article content yet.

      Use ONLY these specific Amazon products in your article:
      ${affiliateLinks.map((p) => `- ${p.title} (ASIN: ${p.asin})`).join("\n")}

      Each section in the "outline" array must use the ASIN for 'affiliate_connection' instead of the product title.

      Instructions:
      ${STYLE_GUIDELINES}
      - Create a strong SEO-friendly title for the post (aim for 60–70 characters) that includes the main keyword(s) naturally.
      - DO NOT include any <h2>, <p>, or HTML tags
      - DO NOT generate the full article — JUST return the outline
      - The product sections must be tied to one of the exact products listed above

      // …
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

        const outlineResponse = await client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 1500,
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

        // Safely access array elements with null coalescing
        let jsonStr = "";
        if (Array.isArray(outlineJson)) {
          jsonStr = outlineJson[1] ?? outlineJson[0] ?? outlineJson.toString();
        } else {
          jsonStr = outlineJson.toString();
        }

        let outlineResult;
        try {
          let cleanedStr = jsonStr.replace(/```json|```/g, "").trim();
          cleanedStr = cleanedStr.replace(/[\u0000-\u001F\u007F]/g, ""); // Strip bad control characters

          outlineResult = JSON.parse(cleanedStr);

          // 🛑 Detect if Claude hallucinated full blog content
          if (
            typeof outlineResult.content === "string" &&
            /<h[1-3]>/i.test(outlineResult.content)
          ) {
            throw new Error(
              "❌ Claude returned full article content instead of an outline. Aborting section generation.",
            );
          }

          // 🧠 Handle if outline is wrapped under `content.outline`
          if (outlineResult.content?.outline) {
            outlineResult = {
              title: outlineResult.title,
              outline: outlineResult.content.outline,
            };
          }

          // 🚦 verify every ASIN in the outline exists in our affiliate list
          const badAsin = outlineResult.outline.find(
            (sec: any) =>
              !affiliateLinks.some((p) => p.asin === sec.affiliate_connection),
          );
          if (badAsin) {
            throw new Error("Claude returned an unknown ASIN in the outline.");
          }

          if (outlineResult.outline.length === 0) {
            console.warn(
              "⚠️ Outline array is empty. Claude may not have followed instructions.",
            );
          }

          // ✅ Final guard
          if (!Array.isArray(outlineResult.outline)) {
            console.warn(
              "⚠️ outlineResult.outline is not a valid array. Using fallback.",
            );
            outlineResult = {
              title: outlineResult.title || "Blog Post",
              outline: [],
            };
          }
        } catch (e) {
          console.error("Failed to parse outline JSON:", e, outlineJson);
          outlineResult = {
            title: "Blog Post About " + keywords.join(", "),
            outline: [],
          };
        }

        const excerptPrompt = `In an engaging, informative, knowledgeable, and conversational tone write a catchy, 1-2 sentence excerpt for a blog post titled "${outlineResult.title}" that entices readers to continue reading.
          
          Instructions:
          ${STYLE_GUIDELINES}`;

        const excerptResponse = await client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 150,
          temperature: 0.7,
          messages: [{ role: "user", content: excerptPrompt }],
        });
        const postExcerpt = this.trimToCompleteSentence(
          this.extractTextContent(excerptResponse),
        );

        let affiliateLinksHTML = "";
        if (affiliateLinks.length > 0) {
          const validAffiliateLinks = affiliateLinks.filter(
            (link) => link.title && link.affiliateLink,
          );
          if (validAffiliateLinks.length > 0) {
            affiliateLinksHTML =
              `<div class="product-links">\n` +
              `<h2>Our Top Picks for the Year (2025)</h2>\n` +
              validAffiliateLinks
                .map(
                  (link) =>
                    `<p><a href="${link.affiliateLink}" target="_blank" rel="nofollow">${link.title}</a></p>`,
                )
                .join("\n") +
              `\n</div>`;
          }
        }
        const firstHeading =
          outlineResult.outline?.[0]?.heading ?? "First Section";

        const introPrompt = `Write an engaging introduction for "${outlineResult.title}".
      
      Instructions:
      ${STYLE_GUIDELINES}
      - Natural transition to the first section: "${firstHeading}"

      Important: End at the previous sentence. Do NOT leave content hanging.
      Format with <p> tags only.`;

        const introResponse = await client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 700,
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
        console.log("[AnthropicService] Starting product sections generation");
        for (const section of outlineResult.outline || []) {
          console.log("[AnthropicService] Processing section:", {
            heading: section.heading,
            subheadingsCount: section.subheadings.length,
            affiliateConnection: section.affiliate_connection,
          });

          const product = affiliateLinks.find(
            (p) => p.asin === section.affiliate_connection,
          );

          if (!product) {
            console.warn(
              "[AnthropicService] No matching product found for:",
              section.affiliate_connection,
            );
            continue;
          }

          const imageInstruction = product.imageUrl
            ? `- Add this image block at the start of the section:\n  <a href="${product.affiliateLink}" target="_blank" rel="nofollow">\n    <img src="${product.imageUrl}" alt="${product.title}" style="max-width:100%; height:auto;" />\n  </a>`
            : "- Skip the image if none is available";

          console.log("[AnthropicService] Found matching product:", {
            title: product.title,
            asin: product.asin,
            hasImage: !!product.imageUrl,
            hasAffiliate: !!product.affiliateLink,
          });

          const productPrompt = `Write a detailed product review for "${product.title}".

        Use ${product.description} to understand what the product does and what are the features and other details. Then use this information to write the review. Explain how each key feature BENEFITS the reader – don’t just list specs

      Provide:
      - Use this heading: <h2><a href="${product.affiliateLink}" target="_blank" rel="nofollow">${product.title}</a></h2>
      - ${imageInstruction}
      - 2-3 <h3> sub‑sections
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

          const productResponse = await client.messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: 1200,
            temperature: 0.7,
            messages: [{ role: "user", content: productPrompt }],
          });

          let productContent = this.trimToCompleteSentence(
            this.extractTextContent(productResponse),
          );

          // insert price under the <h2> title
          const priceHtml = product.price
            ? `<p><strong>Price:</strong> ${product.price}</p>`
            : "";
          // inject it right after the H2
          productContent = productContent.replace(
            /(<h2>[\s\S]*?<\/h2>)/,
            `$1\n${priceHtml}`
          );

          // Safety: close <ul> if Claude forgot
          if (
            productContent.includes("<ul>") &&
            !productContent.includes("</ul>")
          ) {
            productContent += "</ul>";
          }

        fullContent += `${productContent}\n\n`;
        }

        // === Wrap-Up Section ===

        const wrapPrompt = `Write a wrap-up section for the blog post titled "${outlineResult.title}".
        
        Instructions:
        ${STYLE_GUIDELINES}
        - Summarize key insights for the exact products from the product sections
        - Encourage the reader to take action and choose confidently`;

        const wrapResponse = await client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 700,
          temperature: 0.7,
          messages: [{ role: "user", content: wrapPrompt }],
        });

        const wrapContent = this.trimToCompleteSentence(
          this.extractTextContent(wrapResponse),
        );
        fullContent += wrapContent + "\n\n";

        // === FAQ Section ===

        const faqPrompt = `Write 5 detailed FAQs related to "${outlineResult.title}".
        Each FAQ should use <h3> for the question and <p> for the answer.
        Instructions:
        ${STYLE_GUIDELINES }
        - Format using plain HTML only – no markdown.
        - Begin the response with the required HTML tag (e.g., <h3>) and the actual content, with **no pre‑amble or meta commentary**.`;

        const faqResponse = await client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 2000,
          temperature: 0.7,
          messages: [{ role: "user", content: faqPrompt }],
        });

        const faqContent = this.trimToCompleteSentence(
          this.extractTextContent(faqResponse),
        );
        fullContent +=
          `<h2>Frequently Asked Questions</h2>

` + faqContent;

        // Clean up extra tags and newlines
        fullContent = fullContent
          .replace(/<p>\s*<p>/g, "<p>")
          .replace(/<\/ul>\s*<\/ul>/g, "</ul>")
          .replace(/<ul>\s*<ul>/g, "<ul>")
          .replace(/<p>\s*<\/p>/g, "") // remove empty <p> tags
          .replace(/\n{3,}/g, "\n\n"); // limit too many newlines

        return {
          title: outlineResult.title,
          snippet: postExcerpt,
          content: fullContent.trim(),
        };
      } catch (error) {
        console.error("Anthropic content generation failed:", error);
        throw new Error(
          `Failed to generate content: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    } catch (error) {
      console.error("Anthropic FAQ generation failed:", error);
      throw new Error(
        `Failed to generate FAQs: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export const anthropicService = new AnthropicService();
