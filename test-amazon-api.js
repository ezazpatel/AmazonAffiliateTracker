// Script to test Amazon API functionality
import crypto from 'crypto';

// We'll use the same environment variables as the main application
const AMAZON_PARTNER_ID = process.env.AMAZON_PARTNER_ID;
const AMAZON_API_KEY = process.env.AMAZON_API_KEY;
const AMAZON_SECRET_KEY = process.env.AMAZON_SECRET_KEY;

// Function to test the Amazon API search 
async function testAmazonSearch(keyword = 'security camera') {
  console.log(`Testing Amazon API search for keyword: "${keyword}"`);
  console.log(`Using credentials - Partner ID: ${AMAZON_PARTNER_ID}, API Key: [masked], Secret Key: [masked]`);

  if (!AMAZON_PARTNER_ID || !AMAZON_API_KEY || !AMAZON_SECRET_KEY) {
    console.error('Amazon API credentials missing! Make sure they are set in environment variables:');
    console.error('  AMAZON_PARTNER_ID, AMAZON_API_KEY, AMAZON_SECRET_KEY');
    return;
  }

  try {
    // API endpoint details
    const host = "webservices.amazon.com";
    const region = "us-east-1";
    const uri = "/paapi5/searchitems";
    const service = "ProductAdvertisingAPI";

    // Get the current time in ISO format for request signing
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    // Request payload
    const payload = JSON.stringify({
      Keywords: keyword,
      Resources: [
        "ItemInfo.Title",
        "Images.Primary.Large",
        "CustomerReviews.StarRating",
        "CustomerReviews.Count",
        "ItemInfo.ByLineInfo",
      ],
      PartnerTag: AMAZON_PARTNER_ID,
      PartnerType: "Associates",
      Marketplace: "www.amazon.com",
      ItemCount: 10,
      Condition: "New",
      SearchIndex: "All",
    });

    // Create request headers based on API specifications
    const headers = {
      host: host,
      "content-type": "application/json; charset=utf-8",
      "content-encoding": "amz-1.0",
      "x-amz-target": "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems",
      "x-amz-date": amzDate,
    };

    // Build the canonical headers and signed headers strings for signing
    const canonicalHeaders =
      Object.keys(headers)
        .sort()
        .map((key) => `${key}:${headers[key]}`)
        .join("\n") + "\n";
    const signedHeaders = Object.keys(headers).sort().join(";");

    // Create the canonical request
    const payloadHash = crypto
      .createHash("sha256")
      .update(payload)
      .digest("hex");
    const canonicalRequest = [
      "POST",
      uri,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    // Build the string to sign
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    // Calculate the signature
    const kDate = crypto
      .createHmac("sha256", `AWS4${AMAZON_SECRET_KEY}`)
      .update(dateStamp)
      .digest();
    const kRegion = crypto
      .createHmac("sha256", kDate)
      .update(region)
      .digest();
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

    // Create the authorization header
    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${AMAZON_API_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // Make the API request to Amazon
    const url = `https://${host}${uri}`;
    console.log(`Making request to: ${url}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        Authorization: authorizationHeader,
        "Content-Length": Buffer.byteLength(payload).toString(),
      },
      body: payload,
    });

    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error("Response:", errorBody);
      return;
    }

    const data = await response.json();
    
    if (!data.SearchResult || !data.SearchResult.Items) {
      console.log("Response was successful but no items found.");
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    
    console.log(`Found ${data.SearchResult.Items.length} items`);
    
    // Process and display the results
    const products = data.SearchResult.Items.map(item => {
      const rating = Number(
        item.CustomerReviews?.StarRating?.DisplayValue || 0
      );
      const reviewCount = Number(item.CustomerReviews?.Count || 0);
      
      return {
        asin: item.ASIN,
        title: item.ItemInfo.Title.DisplayValue,
        description: item.ItemInfo.ByLineInfo?.Brand
          ? `${item.ItemInfo.ByLineInfo.Brand.DisplayValue} product with excellent quality and value.`
          : "Quality product from Amazon.",
        imageUrl: item.Images?.Primary?.Large?.URL,
        affiliateLink: `https://www.amazon.com/dp/${item.ASIN}?tag=${AMAZON_PARTNER_ID}&linkCode=ll1&language=en_US&ref_=as_li_ss_tl`,
        rating,
        reviewCount,
      };
    });
    
    // Display the first 3 products
    console.log("Top 3 products:");
    products.slice(0, 3).forEach((product, i) => {
      console.log(`\nProduct ${i + 1}:`);
      console.log(`Title: ${product.title}`);
      console.log(`ASIN: ${product.asin}`);
      console.log(`Rating: ${product.rating} (${product.reviewCount} reviews)`);
      console.log(`Image URL: ${product.imageUrl}`);
      console.log(`Affiliate Link: ${product.affiliateLink}`);
    });
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error("Test failed with error:", error);
  }
}

// Run the test
testAmazonSearch();