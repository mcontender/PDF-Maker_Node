var express = require('express');
const puppeteer = require('puppeteer');
var router = express.Router();

function wait(ms) {
    return new Promise(resolve => setTimeout(() => resolve(), ms));
}

async function SShot(url) {
    let browser = await puppeteer.launch({ headless: false });
    let page = await browser.newPage();
    console.log(url);
    try {
        await page.setViewport({ width: 1920, height: 1080 });
        // await page.goto(url, { waitUntil: 'networkidle2' });// make sure all JS is loaded and all Ajax requests are done.
        await page.emulateMedia('screen'); // or screen
        // await page.screenshot({ path: './public/screenshots/test.jpg', type: 'jpeg', fullPage: false });
        await page.goto(url);

        // ----------------------
        // SECTION
        // const element = await page.$('.tile-container');
        // await element.screenshot({ path: './public/screenshots/section.png' });
        // ----------------------

        // ----------------------
        // LAZY LOAD
        const bodyHandle = await page.$('.globalWrapper');
        const { height } = await bodyHandle.boundingBox();
        await bodyHandle.dispose();
        await page.screenshot({ path: './public/screenshots/test.jpg', type: 'jpeg', fullPage: false });

        // Scroll one viewport at a time, pausing to let content load
        // const viewportHeight = page.viewport().height;
        let viewportIncr = 0;
        let screenNum = 0;
        await page.screenshot({ path: './public/screenshots/screen_' + screenNum + '.png' });
        await wait(2000);
        const viewportHeight = page.viewport().height;
        console.log(viewportHeight);

        while (viewportIncr + viewportHeight < height) {
            screenNum++;
            await page.evaluate(_viewportHeight => {
                window.scrollBy(0, _viewportHeight);
            }, viewportHeight);
            await wait(2000);
            viewportIncr = viewportIncr + viewportHeight;
            await page.screenshot({ path: './public/screenshots/screen_' + screenNum + '.png' });
        }
        // ----------------------

        await page.close();
        await browser.close();

    } catch (err) {
        console.log(err);
    }
}

router.get('/', function(req, res, next) {
    console.log('[LOG] Submitted URL: ' + req.query.url);
    SShot(req.query.url);
    res.send('Screenshot taken for: ' + req.query.url); //req.query.url);
});

// router.use(function screenshot(req, res, next) {
//     async function run(url) {
//         let browser = await puppeteer.launch({ headless: false });
//         let page = await browser.newPage();
//         console.log('browser run func');
//         await page.setViewport({ width: 1920, height: 1080 });
//         await page.goto(url);
//         await page.screenshot({ path: './public/screenshots/image.jpg', type: 'jpeg', fullPage: true });
//         await page.close();
//         await browser.close();
//     }
//     next();
// });

module.exports = router;