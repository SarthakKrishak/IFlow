const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log("Navigating to http://localhost:3000/wiki/cmsbyhqj900012ndjrociwo5c");
  await page.goto('http://localhost:3000/wiki/cmsbyhqj900012ndjrociwo5c', { waitUntil: 'networkidle0' });
  
  console.log("Finished. Closing browser.");
  await browser.close();
})();
