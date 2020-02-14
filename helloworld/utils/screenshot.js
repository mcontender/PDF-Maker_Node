// const puppeteer = require('puppeteer');

// async function run(url) {
//     let browser = await puppeteer.launch({ headless: false });
//     let page = await browser.newPage();
//     console.log('browser run func');
//     await page.setViewport({ width: 1920, height: 1080 });
//     await page.goto(url);
//     await page.screenshot({ path: './image.jpg', type: 'jpeg', fullPage: true });
//     await page.close();
//     await browser.close();
// }

// run();