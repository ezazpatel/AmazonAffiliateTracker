import fetch from 'node-fetch';
import { storage } from '../storage';

export class WordPressService {
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const { wpBaseUrl, username, password } = this.getCredentials();
      const auth = Buffer.from(`${username}:${password}`).toString('base64');

      const response = await fetch(`${wpBaseUrl}/wp-json/wp/v2/users/me`, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to connect to WordPress');
      }

      const data = await response.json();
      return { 
        success: true, 
        message: `Connected successfully as ${data.name}` 
      };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  private getCredentials() {
    const wpBaseUrl = process.env.WP_BASE_URL;
    const username = process.env.WP_USERNAME;
    const password = process.env.WP_PASSWORD;

    if (!wpBaseUrl || !username || !password) {
      throw new Error('WordPress credentials not configured in environment variables');
    }

    return { wpBaseUrl, username, password };
  }

  async getRelevantCategories(articleTitle: string): Promise<number[]> {
    const { wpBaseUrl, username, password } = this.getCredentials();
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    try {
      const response = await fetch(`${wpBaseUrl}/wp-json/wp/v2/categories`, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });

      if (!response.ok) {
        console.error("Failed to fetch categories from WordPress");
        return [2]; // Default to Uncategorized
      }

      const categories = await response.json();
      const relevantCategory = categories.find(cat => articleTitle.toLowerCase().includes(cat.name.toLowerCase()));

      if (relevantCategory) {
        return [relevantCategory.id];
      } else {
        //Create new category (replace with actual category creation logic)
        const newCategoryName = this.extractCategoryName(articleTitle);
        const newCategoryResponse = await fetch(`${wpBaseUrl}/wp-json/wp/v2/categories`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: newCategoryName })
        });

        if (!newCategoryResponse.ok) {
          console.error("Failed to create new category in WordPress");
          return [2]; // Default to Uncategorized
        }

        const newCategory = await newCategoryResponse.json();
        return [newCategory.id];
      }
    } catch (error) {
      console.error("Error getting or creating relevant categories:", error);
      return [2]; // Default to Uncategorized
    }
  }

  private extractCategoryName(articleTitle: string): string {
    // Implement logic to extract a suitable category name from the article title.  This is a placeholder.
    //  A more robust implementation might use NLP techniques or predefined rules.
    const words = articleTitle.split(' ');
    return words.slice(0, 2).join(' ');
  }


  async publishArticle(articleId: number) {
    console.log('[WordPressService] Starting article publish:', articleId);

    const article = await storage.getArticle(articleId);
    if (!article) {
      console.error('[WordPressService] Article not found:', articleId);
      throw new Error('Article not found');
    }
    console.log('[WordPressService] Article found:', { id: article.id, title: article.title });

    const { wpBaseUrl, username, password } = this.getCredentials();
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    console.log('[WordPressService] Sending request to WordPress:', wpBaseUrl);

    try {
      const response = await fetch(`${wpBaseUrl}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: article.title,
          content: article.content.replace(/<h1>.*?<\/h1>\s*/, ''), // Remove H1 title
          status: 'publish',
          categories: await this.getRelevantCategories(article.title)
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[WordPressService] WordPress API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Failed to publish to WordPress: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('[WordPressService] Successfully published to WordPress:', result);

      // Get product images
      try {
        const products = await storage.getProductsByArticleId(articleId);
        if (products.length > 0) {
          const { default: sharp } = await import('sharp');

          // Download images and create buffers
          const validProducts = products.filter(p => p.imageUrl);
          console.log('[WordPressService] Processing images for products:', validProducts.length);

          if (validProducts.length === 0) {
            console.log('[WordPressService] No valid product images found, skipping featured image');
            return result;
          }

          const imageBuffers = await Promise.all(
            validProducts.slice(0, 4).map(async (product) => {
              try {
                const response = await fetch(product.imageUrl);
                if (!response.ok) {
                  console.error(`[WordPressService] Failed to fetch image: ${product.imageUrl}`);
                  return null;
                }
                return response.arrayBuffer();
              } catch (error) {
                console.error(`[WordPressService] Error downloading image: ${error}`);
                return null;
              }
            })
          );

          // Filter out any null buffers from failed downloads
          const validBuffers = imageBuffers.filter(buffer => buffer !== null);

          if (validBuffers.length === 0) {
            console.log('[WordPressService] No valid image buffers, skipping featured image');
            return result;
          }

          // Calculate dimensions for 2x2 grid
          const width = 1200;
          const height = 630;
          const cellWidth = width / 2;
          const cellHeight = height / 2;

          // Create composite image
          const composite = await sharp({
            create: {
              width,
              height,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
          })
          .composite(
            imageBuffers.map((buffer, i) => ({
              input: buffer,
              top: Math.floor(i / 2) * cellHeight,
              left: (i % 2) * cellWidth,
              gravity: 'northwest'
            }))
          )
          .jpeg()
          .toBuffer();

          // Upload composite as featured image
          const imageUploadResponse = await fetch(`${wpBaseUrl}/wp-json/wp/v2/media`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'image/jpeg',
              'Content-Disposition': 'attachment; filename=header.jpg'
            },
            body: composite
          });

          if (imageUploadResponse.ok) {
            const imageData = await imageUploadResponse.json();

            // Set as featured image
            await fetch(`${wpBaseUrl}/wp-json/wp/v2/posts/${result.id}`, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                featured_media: imageData.id
              })
            });
          }
        }
      } catch (error) {
        console.error('[WordPressService] Error processing featured image:', error);
      }

      await storage.updateArticleStatus(articleId, 'published');
      return result;
    } catch (error) {
      console.error('[WordPressService] Publishing failed:', error);
      throw error;
    }
  }
}

export const wordpressService = new WordPressService();