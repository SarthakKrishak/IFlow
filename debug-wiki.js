const puppeteer = require('puppeteer');

// Local-only debug helper. Pass a notebook id as argv, e.g.
//   node debug-wiki.js <notebookId>
const notebookId = process.argv[2] || 'cmsbyhqj900012ndjrociwo5c';

(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    console.log(`Navigating to http://localhost:3000/wiki/${notebookId}`);
    await page.goto(`http://localhost:3000/wiki/${notebookId}`, { waitUntil: 'networkidle0' });

    console.log("Finished.");
  } catch (error) {
    console.error("Debug run failed:", error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
