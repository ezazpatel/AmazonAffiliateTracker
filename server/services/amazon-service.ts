import crypto from "crypto";
import { storage } from "../storage";
import { type InsertProduct } from "@shared/schema";

interface AmazonProduct {
  asin: string;
  title: string;
  description: string;
  imageUrl: string;
  affiliateLink: string;
  price?: string;
  isBuyBoxWinner?: boolean;
  isPrimeEligible?: boolean;
  salesRank?: number;
  condition?: string;
  availabilityType?: string;
}

export class AmazonService {
  private async getApiSettings() {
    const envPartnerId = process.env.AMAZON_PARTNER_ID;
    const envApiKey = process.env.AMAZON_API_KEY;
    const envSecretKey = process.env.AMAZON_SECRET_KEY;

    if (envPartnerId && envApiKey && envSecretKey) {
      return {
        partnerId: envPartnerId,
        apiKey: envApiKey,
        secretKey: envSecretKey,
      };
    }

    throw new Error("Amazon API settings not found in environment variables");
  }

  private async signedAmazonRequest(
    target: string,
    payload: any,
    settings: { apiKey: string; secretKey: string; partnerId: string },
  ): Promise<Response> {
    const host = "webservices.amazon.com";
    const uri = `/${target}`;
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const region = "us-east-1";
    const service = "ProductAdvertisingAPI";
    const algorithm = "AWS4-HMAC-SHA256";

    const opMap = {
      getitems: "GetItems",
      searchitems: "SearchItems",
    };

    const opKey = target.split("/")[1].toLowerCase(); // safely lowercased
    const opName = opMap[opKey]; // reliably mapped to correct casing

    const headers: Record<string, string> = {
      host,
      "content-type": "application/json; charset=utf-8",
      "content-encoding": "amz-1.0",
      "x-amz-target": `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${opName}`,
      "x-amz-date": amzDate,
    };

    const payloadString = JSON.stringify(payload);

    const canonicalHeaders =
      Object.keys(headers)
        .sort()
        .map((key) => `${key}:${headers[key]}`)
        .join("\n") + "\n";

    const signedHeaders = Object.keys(headers).sort().join(";");

    const payloadHash = crypto
      .createHash("sha256")
      .update(payloadString)
      .digest("hex");

    const canonicalRequest = [
      "POST",
      uri,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    const kDate = crypto
      .createHmac("sha256", `AWS4${settings.secretKey}`)
      .update(dateStamp)
      .digest();
    const kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
    const kService = crypto
      .createHmac("sha256", kRegion)
      .update(service)
      .digest();
    const kSigning = crypto
      .createHmac("sha256", kService)
      .update("aws4_request")
      .digest();

    const signature = crypto
      .createHmac("sha256", kSigning)
      .update(stringToSign)
      .digest("hex");

    const authorizationHeader = `${algorithm} Credential=${settings.apiKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return fetch(`https://${host}${uri}`, {
      method: "POST",
      headers: {
        ...headers,
        Authorization: authorizationHeader,
        "Content-Length": Buffer.byteLength(payloadString).toString(),
      },
      body: payloadString,
    });
  }

  /**
   * Search for products on Amazon using the Partner API.
   *
   * This method performs the following steps:
   * 1. Retrieves 100 products from Amazon.
   * 2. Maps each product to include key info like title, buy box, prime eligibility, etc.
   * 3. Filters out products that:
   *    - Are not considered "main" products (using isMainProduct).
   *    - Have a title match score of 0 (i.e. no keyword overlap).
   *    - Are not Buy Box winners, not "New", not in stock, or have poor sales rank.
   * 4. Sorts the remaining products by:
   *    - Best sales rank,
   *    - Then by Prime eligibility,
   *    - Then by title match score.
   * 5. Returns the first 5 products.

   */

  async searchProducts(
    keyword: string,
    count: number = 5,
  ): Promise<AmazonProduct[]> {
    try {
      const settings = await this.getApiSettings();
      console.log(`Searching Amazon for keyword: ${keyword}`);

      if (!settings) {
        throw new Error("Amazon API settings are not available");
      }

      console.log(
        `Using Amazon credentials - Partner ID: ${settings.partnerId}, API Key: [masked]`,
      );

      let allItems: any[] = [];

      for (let page = 1; page <= 10; page++) {
        if (page > 1) {
          console.log(`Waiting 1100ms before fetching page ${page}...`);
        }
        await this.sleep(1100);
        const payload = {
          Keywords: keyword,
          PartnerTag: settings.partnerId,
          PartnerType: "Associates",
          Marketplace: "www.amazon.com",
          Operation: "SearchItems",
          ItemCount: 10,
          ItemPage: page,
          Condition: "New",
          SearchIndex: "All",
          SortBy: "Featured",
          Resources: [
            "BrowseNodeInfo.BrowseNodes",
            "BrowseNodeInfo.BrowseNodes.SalesRank",
            "Images.Primary.Large",
            "ItemInfo.ByLineInfo",
            "ItemInfo.ContentInfo",
            "ItemInfo.Features",
            "ItemInfo.ProductInfo",
            "ItemInfo.TechnicalInfo",
            "ItemInfo.Title",
            "Offers.Listings.Availability.Type",
            "Offers.Listings.Condition",
            "Offers.Listings.DeliveryInfo.IsFreeShippingEligible",
            "Offers.Listings.DeliveryInfo.IsPrimeEligible",
            "Offers.Listings.IsBuyBoxWinner",
            "Offers.Listings.Price",
            "Offers.Listings.Promotions",
            "ParentASIN",
            "SearchRefinements",
          ],
        };

        const response = await this.signedAmazonRequest(
          "paapi5/searchitems",
          payload,
          settings
        );

        if (!response.ok) {
          console.warn(
            `Page ${page} failed with status ${response.status}. Response:`,
            {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              body: await response
                .text()
                .catch((e) => `Failed to read body: ${e}`),
            },
          );
          continue;
        }

        const data = await response.json();
        const items = data.SearchResult?.Items || [];
        allItems.push(...items);

        // Early exit if fewer than 10 results returned
        if (items.length < 10) break;
      }

      console.log(`Collected ${allItems.length} items from all pages`);

      // --- NEW: get richer data for every ASIN we just found ---
      // Do initial filtering with search data
      // Get details for all collected items first
      const allAsins = allItems.map((item: any) => item.ASIN);
      const enrichedProducts = await this.getItemsDetails(allAsins);

      console.log(
        `[AmazonService] Starting with ${enrichedProducts.length} products`,
      );

      // Now score and filter with complete data
      const productsWithScores = enrichedProducts
        .filter((p) => {
          const isValid = p.title;
          if (!isValid)
            console.log(
              `[AmazonService] Filtered out - Missing title: ${p.asin}`,
            );
          return isValid;
        })
        .map((product) => ({
          ...product,
          score: this.scoreProduct(product, keyword),
          isMain: this.isMainProduct(product, keyword),
          isBuyBoxWinner: product.isBuyBoxWinner ?? false,
          isPrimeEligible: product.isPrimeEligible ?? false,
          condition: product.condition?.toLowerCase() ?? "",
          salesRank: product.salesRank ?? Infinity,
        }));

      console.log(
        `[AmazonService] After scoring: ${productsWithScores.length} products`,
      );

      const eligibleProducts = productsWithScores
        .filter((p) => {
          const reasons = [];
          if (p.score === 0) reasons.push("score=0");
          if (!p.isMain) reasons.push("not main product");
          if (!p.isBuyBoxWinner) reasons.push("not buy box winner");
          if (p.condition?.toLowerCase() !== "new")
            reasons.push("not new condition");
          if (typeof p.salesRank !== "number" || p.salesRank >= 10000)
            reasons.push(`invalid rank: ${p.salesRank}`);
          if (
            !["NOW", "IN_STOCK"].includes(
              (p.availabilityType ?? "").toUpperCase(),
            )
          )
            reasons.push(`invalid availability: ${p.availabilityType}`);

          const isEligible = reasons.length === 0;
          if (!isEligible) {
            console.log(
              `[AmazonService] Filtered out ${p.asin} - ${reasons.join(", ")}`,
            );
          }
          return isEligible;
        })
        .sort((a, b) => {
          // First by sales rank
          if ((a.salesRank ?? Infinity) !== (b.salesRank ?? Infinity)) {
            return (a.salesRank ?? Infinity) - (b.salesRank ?? Infinity);
          }
          // Then by Prime eligibility
          if (b.isPrimeEligible !== a.isPrimeEligible) {
            return b.isPrimeEligible ? 1 : -1;
          }
          // Finally by keyword match score
          return b.score - a.score;
        });

      console.log(
        `[AmazonService] After filtering: ${eligibleProducts.length} eligible products`,
      );

      console.log(
        `[AmazonService] Final sort order:`,
        eligibleProducts.slice(0, 5).map((p) => ({
          asin: p.asin,
          salesRank: p.salesRank,
          isPrime: p.isPrimeEligible,
          score: p.score,
        })),
      );

      const topProducts = eligibleProducts.slice(0, count);
      return topProducts;
    } catch (error) {
      console.error("Amazon product search failed:", error);
      if (error instanceof Error) {
        console.error(`Amazon API Error: ${error.message}`);
        console.log(
          "Amazon API requires valid credentials. Please verify your Partner ID, API Key, and Secret Key.",
        );
        throw new Error(`Failed to search Amazon products: ${error.message}`);
      } else {
        throw new Error(`Failed to search Amazon products: Unknown error`);
      }
    }
  }

  /**
   * Add products to storage for a specific article.
   */
  async addProductsToArticle(
    articleId: number,
    products: AmazonProduct[],
  ): Promise<void> {
    for (const product of products) {
      const productData: InsertProduct = {
        articleId,
        asin: product.asin,
        title: product.title,
        description: product.description,
        imageUrl: product.imageUrl,
        affiliateLink: product.affiliateLink,
      };
      await storage.addProduct(productData);
    }
  }

  /**
   * Helper function to capitalize the first letter of each word.
   */
  private capitalizeFirstLetter(str: string): string {
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getItemsDetails(asins: string[]): Promise<AmazonProduct[]> {
    const settings = await this.getApiSettings();
    const results: AmazonProduct[] = [];
    const batchSize = 10;

    for (let i = 0; i < asins.length; i += batchSize) {
      const batchAsins = asins.slice(i, i + batchSize);
      const payload = {
        ItemIds: batchAsins,
        Resources: [
          "BrowseNodeInfo.BrowseNodes",
          "BrowseNodeInfo.BrowseNodes.SalesRank",
          "Images.Primary.Large",
          "ItemInfo.ByLineInfo",
          "ItemInfo.ContentInfo",
          "ItemInfo.Features",
          "ItemInfo.ProductInfo",
          "ItemInfo.TechnicalInfo",
          "ItemInfo.Title",
          "Offers.Listings.Availability.Type",
          "Offers.Listings.Condition",
          "Offers.Listings.DeliveryInfo.IsFreeShippingEligible",
          "Offers.Listings.DeliveryInfo.IsPrimeEligible",
          "Offers.Listings.IsBuyBoxWinner",
          "Offers.Listings.Price",
          "Offers.Listings.Promotions",
          "ParentASIN",
        ],
        PartnerTag: settings.partnerId,
        PartnerType: "Associates",
        Marketplace: "www.amazon.com",
        Operation: "GetItems",
      };

      try {
        const response = await this.signedAmazonRequest(
          "paapi5/getitems",
          payload,
          settings,
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `❌ Failed for batch with status ${response.status}:`,
            errorText,
            batchAsins,
          );
          continue;
        }

        const json = await response.json();
        const item = json?.ItemsResult?.Items?.[0];

        const items = json?.ItemsResult?.Items || [];
        for (const item of items) {
          const offer = item.Offers?.Listings?.[0];
          results.push({
            asin: item.ASIN,
            title: item.ItemInfo?.Title?.DisplayValue,
            description: (item.ItemInfo?.Features?.DisplayValues ?? []).join(
              "; ",
            ),
            imageUrl: item.Images?.Primary?.Large?.URL,
            price: offer?.Price?.Money?.DisplayAmount,
            isBuyBoxWinner: offer?.IsBuyBoxWinner ?? false,
            isPrimeEligible: offer?.DeliveryInfo?.IsPrimeEligible ?? false,
            condition: offer?.Condition?.Value ?? "",
            availabilityType: offer?.Availability?.Type ?? "",
            salesRank: item.BrowseNodeInfo?.BrowseNodes?.[0]?.SalesRank,
            affiliateLink: `https://www.amazon.com/dp/${item.ASIN}?tag=${settings.partnerId}`,
          });
        }
      } catch (error) {
        console.error(`❌ Error for batch:`, batchAsins, error);
      }

      if (i + batchSize < asins.length) {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
    }
    return results;
  }

  /**
   * Calculate a score for how closely a product title matches the keyword.
   * This is a simple heuristic that counts how many words in the keyword
   * appear in the product title (case–insensitive).
   */
  private scoreProduct(product: AmazonProduct, keyword: string): number {
    const title = product.title.toLowerCase();
    let score = 0;
    for (const word of keyword.toLowerCase().split(" ")) {
      if (title.includes(word)) {
        score++;
      }
    }
    return score;
  }

  /**
   * Determine whether a product is considered a main product (i.e. not an accessory)
   * unless the primary search keyword explicitly suggests an accessory.
   */
  private isMainProduct(
    product: AmazonProduct,
    primaryKeyword: string,
  ): boolean {
    const title = product.title.toLowerCase();
    const accessoryIndicators = ["mount", "accessory", "installation kit"];

    // If the search keyword itself suggests an accessory, allow it.
    const primaryIsAccessory = accessoryIndicators.some((indicator) =>
      primaryKeyword.toLowerCase().includes(indicator),
    );
    if (primaryIsAccessory) {
      return true;
    }

    // Otherwise, exclude items whose title includes common accessory indicators.
    return !accessoryIndicators.some((indicator) => title.includes(indicator));
  }
}

export const amazonService = new AmazonService();