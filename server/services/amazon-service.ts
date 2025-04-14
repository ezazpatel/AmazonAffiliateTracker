import crypto from "crypto";
import { storage } from "../storage";
import { type InsertProduct } from "@shared/schema";

interface AmazonProduct {
  asin: string;
  title: string;
  description: string;
  imageUrl: string;
  affiliateLink: string;
}

export class AmazonService {
  private async getApiSettings() {
    // First try to get the settings from environment variables
    const envPartnerId = process.env.AMAZON_PARTNER_ID;
    const envApiKey = process.env.AMAZON_API_KEY;
    const envSecretKey = process.env.AMAZON_SECRET_KEY;
    
    // If all environment variables are present, use them
    if (envPartnerId && envApiKey && envSecretKey) {
      return {
        partnerId: envPartnerId,
        apiKey: envApiKey,
        secretKey: envSecretKey,
      };
    }
    
    // Fallback to database settings if environment variables are not available
    const settings = await storage.getApiSettings();
    
    if (!settings || !settings.amazonPartnerId || !settings.amazonApiKey || !settings.amazonSecretKey) {
      throw new Error("Amazon API settings not configured");
    }
    
    return {
      partnerId: settings.amazonPartnerId,
      apiKey: settings.amazonApiKey,
      secretKey: settings.amazonSecretKey,
    };
  }
  
  /**
   * Generate a signature for Amazon API requests
   */
  private generateSignature(secretKey: string, payload: string): string {
    const signature = crypto.createHmac('sha256', secretKey)
      .update(payload)
      .digest('base64');
    return signature;
  }

  /**
   * Search for products on Amazon using the Partner API
   */
  async searchProducts(keyword: string, count: number = 5): Promise<AmazonProduct[]> {
    try {
      const settings = await this.getApiSettings();
      console.log(`Searching Amazon for keyword: ${keyword}`);
      
      // API endpoint details
      const host = 'webservices.amazon.com';
      const region = 'us-east-1';
      const uri = '/paapi5/searchitems';
      const service = 'ProductAdvertisingAPI';
      
      console.log(`Using Amazon credentials - Partner ID: ${settings.partnerId}, API Key: [masked]`);
      
      // Get the current time in ISO format for request signing
      const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzDate.slice(0, 8);
      
      // Create the request payload according to Amazon's examples
      const payload = JSON.stringify({
        "Keywords": keyword,
        "Resources": [
          "Images.Primary.Large",
          "ItemInfo.Title",
          "ItemInfo.Features",
          "ItemInfo.ByLineInfo",
          "ItemInfo.ContentInfo",
          "ItemInfo.ProductInfo",
          "Offers.Listings.Price",
          "Offers.Summaries"
        ],
        "PartnerTag": settings.partnerId,
        "PartnerType": "Associates",
        "Marketplace": "www.amazon.com",
        "Operation": "SearchItems",
        "ItemCount": count,
        "MinReviewsRating": 4,
        "SearchIndex": "All"
      });
      
      // Create the request headers
      const algorithm = 'AWS4-HMAC-SHA256';
      const headers: Record<string, string> = {
        'host': host,
        'content-type': 'application/json; charset=utf-8',
        'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
        'x-amz-date': amzDate
      };
      
      // Create the canonical headers string for signing
      const canonicalHeaders = Object.keys(headers)
        .sort()
        .map(key => `${key}:${headers[key]}`)
        .join('\n') + '\n';
      
      const signedHeaders = Object.keys(headers).sort().join(';');
      
      // Create the canonical request
      const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
      const canonicalRequest = [
        'POST',
        uri,
        '',
        canonicalHeaders,
        signedHeaders,
        payloadHash
      ].join('\n');
      
      // Create the string to sign
      const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
      const stringToSign = [
        algorithm,
        amzDate,
        credentialScope,
        crypto.createHash('sha256').update(canonicalRequest).digest('hex')
      ].join('\n');
      
      // Calculate the signature
      const kDate = crypto.createHmac('sha256', `AWS4${settings.secretKey}`).update(dateStamp).digest();
      const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
      const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
      const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
      const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
      
      // Create the authorization header value
      const authorizationHeader = `${algorithm} Credential=${settings.apiKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
      
      // Make the request to the Product Advertising API endpoint
      const url = `https://${host}${uri}`;
      console.log(`Making Amazon API request to: ${url}`);
      
      // Log the complete request details for debugging
      console.log(`Request headers:`, JSON.stringify({
        ...headers,
        'Authorization': authorizationHeader.substring(0, 60) + '...',
        'Content-Length': Buffer.byteLength(payload).toString()
      }, null, 2));
      
      console.log(`Request payload: ${payload}`);
      
      // Make the API request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Authorization': authorizationHeader,
          'Content-Length': Buffer.byteLength(payload).toString()
        },
        body: payload
      });
    
      // Handle API response
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Amazon API error response:", errorText);
        throw new Error(`Amazon API responded with status ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log("Amazon API raw response:", JSON.stringify(data).substring(0, 500) + "...");
      
      // Process the response to extract product information
      const products: AmazonProduct[] = [];
      
      if (data.SearchResult && data.SearchResult.Items) {
        const items = data.SearchResult.Items;
        console.log(`Found ${items.length} items in search results`);
        
        for (const item of items.slice(0, count)) {
          const asin = item.ASIN;
          const title = item.ItemInfo.Title.DisplayValue;
          
          // Extract description from Features or use a default
          let description = "Quality product from Amazon.";
          if (item.ItemInfo.Features && item.ItemInfo.Features.DisplayValues) {
            description = item.ItemInfo.Features.DisplayValues.slice(0, 3).join(' ');
          }
          
          // Get image URL
          const imageUrl = item.Images.Primary.Large.URL;
          
          // Create affiliate link
          const affiliateLink = `https://www.amazon.com/dp/${asin}?tag=${settings.partnerId}`;
          
          products.push({
            asin,
            title,
            description,
            imageUrl,
            affiliateLink
          });
        }
      }
      
      // Check if we found enough products
      if (products.length === 0) {
        throw new Error(`No products found for keyword "${keyword}"`);
      } else if (products.length < count) {
        console.warn(`Only found ${products.length} products for keyword "${keyword}" instead of requested ${count}`);
      }
      
      return products;
      
    } catch (error) {
      console.error("Amazon product search failed:", error);
      
      // Provide helpful error message
      if (error instanceof Error) {
        console.error(`Amazon API Error: ${error.message}`);
        console.log('Amazon API requires valid credentials. Please verify your Partner ID, API Key, and Secret Key.');
        throw new Error(`Failed to search Amazon products: ${error.message}`);
      } else {
        throw new Error(`Failed to search Amazon products: Unknown error`);
      }
    }
  }
  
  /**
   * Add products to storage for a specific article
   */
  async addProductsToArticle(articleId: number, products: AmazonProduct[]): Promise<void> {
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
   * Helper function to capitalize first letter of each word
   */
  private capitalizeFirstLetter(str: string): string {
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  /**
   * Helper function to generate a product suffix
   */
  private getProductSuffix(index: number): string {
    const suffixes = [
      "Pro Max", 
      "Elite Edition", 
      "Premium", 
      "Deluxe", 
      "Ultra", 
      "Advanced", 
      "Plus",
      "Standard",
      "Compact",
      "Mini"
    ];
    
    return suffixes[index % suffixes.length];
  }
  
  /**
   * Helper function to generate product description
   */
  private getProductDescription(index: number): string {
    const descriptions = [
      "features advanced technology for maximum performance and reliability.",
      "is designed for professional use with premium materials and craftsmanship.",
      "offers exceptional value with its innovative features and elegant design.",
      "combines cutting-edge technology with user-friendly interfaces.",
      "is perfect for both beginners and experts seeking quality and durability."
    ];
    
    return descriptions[index % descriptions.length];
  }
  
  /**
   * Generate a random Amazon image ID
   */
  private generateImageId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }
}

export const amazonService = new AmazonService();