// bloomberg-multi-country-scraper.ts
import puppeteer from 'puppeteer';
import fs from 'fs';

interface BloombergBondData {
  country: string;
  name: string;
  coupon: number | null;
  price: number | null;
  yield: number | null;
  oneMonth: number | null;
  oneYear: number | null;
  scrapedAt: string;
}

interface CountryConfig {
  name: string;
  url: string;
  code: string;
}

const COUNTRIES: CountryConfig[] = [
  {
    name: 'United States',
    url: 'https://www.bloomberg.com/markets/rates-bonds/government-bonds/us',
    code: 'US'
  },
  {
    name: 'United Kingdom',
    url: 'https://www.bloomberg.com/markets/rates-bonds/government-bonds/uk',
    code: 'UK'
  },
  {
    name: 'Germany',
    url: 'https://www.bloomberg.com/markets/rates-bonds/government-bonds/germany',
    code: 'DE'
  },
  {
    name: 'Japan',
    url: 'https://www.bloomberg.com/markets/rates-bonds/government-bonds/japan',
    code: 'JP'
  },
  {
    name: 'Australia',
    url: 'https://www.bloomberg.com/markets/rates-bonds/government-bonds/australia',
    code: 'AU'
  }
];

async function scrapeCountryBonds(browser: any, country: CountryConfig): Promise<BloombergBondData[]> {
  const page = await browser.newPage();
  
  // Enhanced headers to appear more like a real browser
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Set additional headers
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  });

  console.log(`🌐 Scraping ${country.name} (${country.url})...`);
  
  try {
    const response = await page.goto(country.url, { 
      waitUntil: 'networkidle0', 
      timeout: 45000 
    });
    
    console.log(`📡 Response status for ${country.name}: ${response?.status()}`);
    
    // Wait longer and try multiple strategies
    await page.waitForTimeout(8000);
    
    // Try to wait for any potential table or data container
    try {
      await page.waitForSelector('table, [data-module], .data-table, .bond-table', { timeout: 10000 });
      
    } catch (e) {
      console.log(`⚠️  No standard data container found for ${country.name}, trying alternative selectors...`);
    }
    
    const data = await page.evaluate((countryName: string) => {
      const bonds: any[] = [];
      
      const parseNumeric = (text: string): number | null => {
        if (!text || text.trim() === '' || text === '--' || text === 'N/A') return null;
        const cleaned = text.replace(/[,%$£€¥]/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      };
      
      // Debug: Log what we can see on the page
      console.log('=== PAGE DEBUG INFO ===');
      console.log('Page title:', document.title);
      console.log('Tables found:', document.querySelectorAll('table').length);
      console.log('Data modules found:', document.querySelectorAll('[data-module]').length);
      console.log('Page text length:', document.body.innerText.length);
      
      // Strategy 1: Look for tables with more flexible criteria
      const tables = document.querySelectorAll('table');
      console.log('Processing', tables.length, 'tables...');
      
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const rows = table.querySelectorAll('tr');
        console.log(`Table ${i}: ${rows.length} rows`);
        
        if (rows.length < 2) continue;
        
        // Log first few rows to understand structure
        for (let r = 0; r < Math.min(3, rows.length); r++) {
          const cells = rows[r].querySelectorAll('td, th');
          console.log(`Row ${r}:`, Array.from(cells).map(c => c.textContent?.trim().substring(0, 20)));
        }
        
        const headerText = rows[0].textContent?.toLowerCase() || '';
        
        // More flexible header detection
        if (headerText.includes('name') || headerText.includes('security') || 
            headerText.includes('bond') || headerText.includes('gilt') || 
            headerText.includes('treasury') || headerText.includes('yield') ||
            headerText.includes('maturity') || headerText.includes('coupon')) {
          
          console.log('Found potential bond table:', headerText.substring(0, 100));
          
          for (let j = 1; j < rows.length; j++) {
            const row = rows[j];
            const cells = row.querySelectorAll('td, th');
            
            if (cells.length >= 2) {
              const name = cells[0]?.textContent?.trim() || '';
              const coupon = cells[1]?.textContent?.trim() || '';
              const price = cells[2]?.textContent?.trim() || '';
              const yieldText = cells[3]?.textContent?.trim() || '';
              const oneMonth = cells[4]?.textContent?.trim() || '';
              const oneYear = cells[5]?.textContent?.trim() || '';
              
              // More flexible name validation
              if (name && name.length > 1 && 
                  !name.toLowerCase().includes('name') && 
                  !name.toLowerCase().includes('security') &&
                  (name.match(/\d/) || name.toLowerCase().includes('year') || 
                   name.toLowerCase().includes('month') || name.toLowerCase().includes('gilt') ||
                   name.toLowerCase().includes('treasury') || name.toLowerCase().includes('bond'))) {
                
                bonds.push({
                  country: countryName,
                  name,
                  coupon: parseNumeric(coupon),
                  price: parseNumeric(price),
                  yield: parseNumeric(yieldText),
                  oneMonth: parseNumeric(oneMonth),
                  oneYear: parseNumeric(oneYear),
                  scrapedAt: new Date().toISOString()
                });
              }
            }
          }
        }
      }
      
      // Strategy 2: Look for Bloomberg-specific selectors and data attributes
      if (bonds.length === 0) {
        console.log('Trying Bloomberg-specific selectors...');
        
        const bloombergSelectors = [
          '[data-module="DataTable"]',
          '.data-table',
          '.bond-table',
          '[class*="table"]',
          '[class*="bond"]',
          '[class*="security"]',
          '.bb-table',
          '[data-testid*="table"]',
          '[role="table"]',
          '.rates-table'
        ];
        
        for (const selector of bloombergSelectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`Selector ${selector}: found ${elements.length} elements`);
          
          elements.forEach(element => {
            const rows = element.querySelectorAll('tr, .table-row, [role="row"]');
            console.log(`Element has ${rows.length} rows`);
            
            rows.forEach((row, index) => {
              if (index === 0) return; // Skip header
              
              const cells = row.querySelectorAll('td, .table-cell, .data-cell, [role="cell"], [role="gridcell"]');
              
              if (cells.length >= 2) {
                const name = cells[0]?.textContent?.trim() || '';
                const coupon = cells[1]?.textContent?.trim() || '';
                const price = cells[2]?.textContent?.trim() || '';
                const yieldText = cells[3]?.textContent?.trim() || '';
                const oneMonth = cells[4]?.textContent?.trim() || '';
                const oneYear = cells[5]?.textContent?.trim() || '';
                
                if (name && name.length > 2 && name.match(/\w/)) {
                  bonds.push({
                    country: countryName,
                    name,
                    coupon: parseNumeric(coupon),
                    price: parseNumeric(price),
                    yield: parseNumeric(yieldText),
                    oneMonth: parseNumeric(oneMonth),
                    oneYear: parseNumeric(oneYear),
                    scrapedAt: new Date().toISOString()
                  });
                }
              }
            });
          });
        }
      }
      
      // Strategy 3: Enhanced text parsing with country-specific keywords
      if (bonds.length === 0) {
        console.log('Trying enhanced text parsing...');
        const pageText = document.body.innerText;
        const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        // Country-specific keywords
        const bondKeywords = {
          'United States': ['treasury', 'bond', 'note', 'bill'],
          'United Kingdom': ['gilt', 'treasury', 'bond'],
          'Germany': ['bund', 'bobl', 'schatz', 'treasury'],
          'Japan': ['bond', 'treasury', 'jgb'],
          'Australia': ['bond', 'treasury', 'agb']
        };
        
        const keywords = bondKeywords[countryName] || ['bond', 'treasury'];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // More sophisticated pattern matching
          const hasKeyword = keywords.some(keyword => line.toLowerCase().includes(keyword));
          const hasNumbers = line.match(/\d+\.\d{1,4}/g);
          const hasYear = line.match(/20\d{2}|'?\d{2}/);
          const hasPercent = line.includes('%');
          
          if ((hasKeyword || hasPercent) && hasNumbers && line.length > 5) {
            const context = lines.slice(Math.max(0, i-1), i + 3).join(' ');
            const numbers = context.match(/\d+\.\d{1,4}/g) || [];
            
            if (numbers.length >= 1) {
              bonds.push({
                country: countryName,
                name: line,
                coupon: parseFloat(numbers[0]) || null,
                price: parseFloat(numbers[1]) || null,
                yield: parseFloat(numbers[2]) || null,
                oneMonth: parseFloat(numbers[3]) || null,
                oneYear: parseFloat(numbers[4]) || null,
                scrapedAt: new Date().toISOString()
              });
            }
          }
        }
      }
      
      console.log(`Found ${bonds.length} bonds for ${countryName}`);
      
      // Debug: Show first few bonds found
      if (bonds.length > 0) {
        console.log('Sample bonds:', bonds.slice(0, 3));
      } else {
        // Log page content sample for debugging
        console.log('Page text sample:', document.body.innerText.substring(0, 500));
      }
      
      return bonds;
    }, country.name);
    
    await page.close();
    return data;
    
  } catch (error) {
    await page.close();
    return [];
  }
}

async function scrapeAllCountries(debugMode = false): Promise<BloombergBondData[]> {
  const browser = await puppeteer.launch({ 
    headless: debugMode ? false : "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    devtools: debugMode
  });
  
  const allData: BloombergBondData[] = [];
  
  for (const country of COUNTRIES) {
    const countryData = await scrapeCountryBonds(browser, country);
    allData.push(...countryData);
    
    console.log(`✅ ${country.name}: Found ${countryData.length} bonds`);
    
    // Add delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  await browser.close();
  return allData;
}

async function main() {
  const debugMode = process.argv.includes('--debug');
  const allResults = await scrapeAllCountries(debugMode);

  // Filter only 10-Year bonds
  const results = allResults.filter(bond =>
    bond.name.includes('10 Year') &&
    !bond.name.toLowerCase().includes('muni') &&
    !bond.name.toLowerCase().includes('inflation') &&
    !bond.name.includes('II')
  );

  const filename = `10Y-bond-data.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
}

// Export functions for module use
module.exports = {
  scrapeAllCountries,
  scrapeCountryBonds,
  COUNTRIES
};

if (require.main === module) {
  main().catch(() => process.exit(1));
} 