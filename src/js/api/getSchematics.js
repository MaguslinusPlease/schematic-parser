import { exit } from 'process';
import { launch } from 'puppeteer';
import { writeFileSync } from 'fs';

async function getAmountPages(browser) {
    const page = await browser.newPage();
    
    await page.goto('https://www.minecraft-schematics.com/latest/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pagination');
    
    const secondLastPage = await page.evaluate(() => {
        const secondLastLi = document.querySelector('.pagination ul li:nth-last-child(2)');
        
        if (secondLastLi) {
            const link = secondLastLi.querySelector('a');
            return {
                text: link ? parseInt(link.textContent.trim()) : null,
            };
        }
        return null;
    });
    
    await page.close();
    return secondLastPage ? secondLastPage.text : null;
}

async function scrapeAllPages() {
    const browser = await launch({ headless: true });
    const amountPages = await getAmountPages(browser);
    console.log('Total pages:', amountPages);
    const results = [];
    const baseUrl = 'https://www.minecraft-schematics.com';
    
    for (let pageNum = 1; pageNum <= amountPages; pageNum++) {
        // Remove the artificial limit - let it run to the actual end
        console.log(`Processing page ${pageNum}/${amountPages}`);
        
        let page;
        let pageItems = [];
        
        try {
            page = await browser.newPage();
            
            // Disable images and unnecessary resources for faster loading
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if(['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                    req.abort();
                } else {
                    req.continue();
                }
            });
            
            await page.goto(`${baseUrl}/latest/${pageNum}/`, { 
                waitUntil: 'domcontentloaded',
                timeout: 15000 
            });
            
            // Check if page has content
            try {
                await page.waitForSelector('.span4', { timeout: 10000 });
            } catch (error) {
                console.log(`No content found on page ${pageNum}, likely reached the end`);
                await page.close();
                break; // Exit the loop if no content is found
            }
            
            pageItems = await page.evaluate((baseUrl) => {
                const span4Elements = document.querySelectorAll('.span4');
                const items = [];
                
                span4Elements.forEach(span4Element => {
                    const titleElement = span4Element.querySelector('h3 a');
                    const imageElement = span4Element.querySelector('img');
                    
                    if (titleElement) {
                        const title = titleElement.getAttribute('title') || titleElement.textContent.trim();
                        const href = titleElement.getAttribute('href');
                        const fullUrl = `${baseUrl}${href}`;
                        
                        // Extract schematic ID for download link
                        const hrefParts = href.split('/');
                        let downloadLink = '';
                        if (hrefParts.length >= 3 && hrefParts[1] === 'schematic') {
                            const schematicId = hrefParts[2];
                            downloadLink = `https://www.minecraft-schematics.com/download/${schematicId}/`;
                        }
                        
                        const imageSrc = imageElement ? imageElement.src : '';
                        
                        items.push({
                            title,
                            downloadLink,
                            imageSrc,
                            fullUrl,
                            href // Keep href for category lookup
                        });
                    }
                });
                
                return items;
            }, baseUrl);
            
            await page.close();
            
        } catch (error) {
            console.error(`Error processing page ${pageNum}:`, error.message);
            if (page) await page.close();
            continue; // Skip this page and continue with the next one
        }
        
        // Skip category scraping if no items found
        if (pageItems.length === 0) {
            console.log(`No items found on page ${pageNum}`);
            continue;
        }
        
        // Get categories in parallel using 18 concurrent browsers
        console.log(`  Fetching categories for ${pageItems.length} items in parallel...`);
        const itemsWithCategory = await getCategoriesInParallel(browser, pageItems);
        
        results.push({
            page: pageNum,
            items: itemsWithCategory
        });
        
        console.log(`Found ${itemsWithCategory.length} items on page ${pageNum}`);
        
        // SAVE AFTER EACH AND EVERY PAGE - NO DATA LOSS!
        try {
            writeFileSync('./../../../minecraft-schematics.json', JSON.stringify(results, null, 2));
            console.log(`✓ JSON file updated after page ${pageNum} (${results.reduce((sum, page) => sum + page.items.length, 0)} total items scraped)`);
        } catch (saveError) {
            console.error('❌ Error saving after page:', saveError.message);
        }
    }
    
    await browser.close();
    return results;
}

async function getCategoriesInParallel(browser, items) {
    const BATCH_SIZE = 18;
    const results = [];
    
    // Process items in batches of 18
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        console.log(`    Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(items.length/BATCH_SIZE)} (${batch.length} items)`);
        
        const batchPromises = batch.map(async (item, index) => {
            let categoryPage;
            try {
                categoryPage = await browser.newPage();
                
                // Disable resources for faster loading
                await categoryPage.setRequestInterception(true);
                categoryPage.on('request', (req) => {
                    if(['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });
                
                await categoryPage.goto(item.fullUrl, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 15000 
                });
                
                const pageData = await categoryPage.evaluate(() => {
                    // Get category from the table
                    const category = document.querySelector('.span5 table tbody tr:first-child td:nth-child(2)')?.textContent?.trim() || '';
                    
                    // Get the full, untruncated title from the individual page
                    const fullTitle = document.querySelector('h1')?.textContent?.trim() || 
                                     document.querySelector('.page-header h1')?.textContent?.trim() ||
                                     document.querySelector('.schematic-title')?.textContent?.trim() ||
                                     document.querySelector('title')?.textContent?.split('|')[0]?.trim() || '';
                    
                    return {
                        category,
                        fullTitle
                    };
                });
                
                return {
                    title: pageData.fullTitle || item.title, // Use full title if found, otherwise fallback to listing title
                    downloadLink: item.downloadLink,
                    imageSrc: item.imageSrc,
                    fullUrl: item.fullUrl,
                    category: pageData.category
                };
                
            } catch (error) {
                console.error(`      Error getting data for item ${i + index + 1}: ${error.message}`);
                return {
                    title: item.title, // Fallback to listing title if individual page fails
                    downloadLink: item.downloadLink,
                    imageSrc: item.imageSrc,
                    fullUrl: item.fullUrl,
                    category: ''
                };
            } finally {
                if (categoryPage) {
                    try {
                        await categoryPage.close();
                    } catch (closeError) {
                        console.error(`      Error closing page: ${closeError.message}`);
                    }
                }
            }
        });
        
        // Wait for all pages in this batch to complete
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches to be respectful to the server
        if (i + BATCH_SIZE < items.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    return results;
}

// Usage
(async () => {
    let allResults = [];
    try {
        allResults = await scrapeAllPages();
        console.log('Scraping completed successfully!');
    } catch (error) {
        console.error('Error during scraping:', error);
        console.log('Attempting to save partial results...');
        
        // Try to get partial results from progress file
        try {
            const fs = await import('fs');
            const progressData = fs.readFileSync('./../../../minecraft-schematics-progress.json', 'utf8');
            allResults = JSON.parse(progressData);
            console.log('Recovered partial results from progress file');
        } catch (progressError) {
            console.error('Could not recover progress file:', progressError.message);
        }
    } finally {
        // Always try to save results, even if there was an error
        if (allResults.length > 0) {
            try {
                writeFileSync('./../../../minecraft-schematics.json', JSON.stringify(allResults, null, 2));
                console.log('Results saved to minecraft-schematics.json');
                console.log(`Total items scraped: ${allResults.reduce((sum, page) => sum + page.items.length, 0)}`);
                console.log(`Total pages scraped: ${allResults.length}`);
            } catch (writeError) {
                console.error('Error writing final file:', writeError.message);
            }
        } else {
            console.log('No results to save');
        }
    }
})();