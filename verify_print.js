const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.goto('file:///data/user/0/ai.antigem/files/home/.gemini/antigravity-cli/scratch/shibu/qp/index.html');
  // wait for preview to render
  await page.waitForSelector('.qp-page');
  // get orientation class of first page
  const oriClass = await page.evaluate(() => {
    const el = document.querySelector('.qp-page');
    return el ? el.className : null;
  });
  console.log('Orientation class:', oriClass);
  // Click print button (assume button with id "print-btn")
  const printBtn = await page.$('#print-btn');
  if (printBtn) {
    await printBtn.click();
  }
  // wait for dynamic style injection
  await page.waitForFunction(() => !!document.getElementById('dynamic-print-page'));
  const pageStyle = await page.evaluate(() => document.getElementById('dynamic-print-page').innerHTML);
  console.log('Dynamic style:', pageStyle);
  await browser.close();
})();
