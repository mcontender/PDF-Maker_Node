var express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs')
var router = express.Router();

function wait(ms) {
    return new Promise(resolve => setTimeout(() => resolve(), ms));
}

async function SShot(res, next, url) {
    let browser = await puppeteer.launch({ headless: false });
    let page = await browser.newPage();
    let fullPage = false;
    console.log('Page URL: ' + url);
    try {
        var date = new Date();
        var dir = './public/screenshots/' + date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
        console.log('Directory: ' + dir);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // TODO: open and setup monthly cookie
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(url, { waitUntil: 'networkidle2' }); // make sure all JS is loaded and all Ajax requests are done.
        await page.emulateMedia('screen'); // or screen
        // await page.screenshot({ path: './public/screenshots/test.jpg', type: 'jpeg', fullPage: false });
        // await page.goto(url, (waitUntil: 'networkidle2'});

        // ----------------------
        // SECTION
        if (!fullPage) {

            // -----------------------------
            // Lazy Load Page first
            const bodyHandle = await page.$('.gcss-page');
            const { height } = await bodyHandle.boundingBox();
            console.log('Page length: ' + height);
            if (height < 1080) {
                bodyHandle = await page.$('.globa-wrapper');
            }
            await bodyHandle.dispose();

            // Scroll one viewport at a time, pausing to let content load
            let viewportIncr = 0;
            let screenNum = 0;
            await page.screenshot({ path: './public/screenshots/scrolling/screen_' + screenNum + '.png' });
            await wait(2000);
            const viewportHeight = page.viewport().height;
            console.log('Lazy Load: starting');

            while (viewportIncr + viewportHeight < height) {
                screenNum++;
                await page.evaluate(_viewportHeight => {
                    window.scrollBy(0, _viewportHeight);
                }, viewportHeight);
                await wait(2000);
                viewportIncr = viewportIncr + viewportHeight;
                await page.screenshot({ path: './public/screenshots/scrolling/screen_' + screenNum + '.png' });
            }
            console.log('Lazy Load: end');
            // Lazy Load END -----------------------------

            console.log('Children Elements: start finding')
                // execute standard javascript in the context of the page.
                // const stories = await page.evaluate('.parsys', sections => { return $('.parsys').children });
            const sections = await page.evaluate(() => {
                    var results = Array.from(document.querySelectorAll('.parsys')[0].children)
                    var childrenOfChildrenID = Array(results.length);
                    console.log('Children Elements: loop for more')
                    for (var x = 0; x < results.length - 1; x++) {
                        // console.log('children elements: ele = ' + document.querySelectorAll('.' + results[x].className.split(' ')[0])[0].children[0]);
                        if (document.querySelectorAll('.' + results[x].className.split(' ')[0])[0].children[0].id != '') {
                            childrenOfChildrenID[x] = (document.querySelectorAll('.' + results[x].className.split(' ')[0])[0].children[0].id);
                            results[x].childs = childrenOfChildrenID[x];
                        }
                    }
                    return results.map((result) => {
                        return {
                            class: result.className,
                            id: result.id,
                            childID: result.childs,
                            offWidth: result.offsetWidth,
                            offHeight: result.offsetHeight,
                            offLeft: result.offsetLeft,
                            offTop: result.offsetTop
                        }
                    });
                    // console.log(results);
                })
                // const source = await page.content(); // Get full HTML
                // console.log(stories);

            var element;
            element = await page.$('.hero');
            await element.screenshot({ path: './public/screenshots/sections/section_0.png' });
            for (var i = 0; i < sections.length; i++) {
                console.log(sections[i]);
                // console.log('Sections: Childs ' + i + ' (' + sections[i].childs + ')');
                // console.log(sections[i].class.toString().split(' ')[0]);
                if (!sections[i].class.includes('open-container')) {
                    if (sections[i].childID != undefined) {
                        // console.log('Sections: ChildID Used');
                        page.$eval('#' + sections[i].childID, (el) => el.scrollIntoView())
                        await wait(1000);
                        // element = await page.$('#' + sections[i].childID);
                    } else if (sections[i].id != '') {
                        // console.log('Sections: ID Used');
                        page.$eval('#' + sections[i].id, (el) => el.scrollIntoView())
                        await wait(1000);
                        // element = await page.$('#' + sections[i].id);
                    } else {
                        // console.log('Sections: Class Used');
                        page.$eval('.' + sections[i].class.toString().split(' ')[0], (el) => el.scrollIntoView())
                        await wait(1000);
                        // await page.screenshot({
                        //     path: './public/screenshots/sections/section_' + (i + 1) + '.png',
                        //     clip: { x: sections[i].offLeft, y: sections[i].offTop, width: sections[i].offWidth, height: sections[i].offHeight }
                        // });
                    }

                    var fileName = dir + '/section_' + (i + 1) + '.png';
                    await page.screenshot({ path: fileName });
                    // TODO: After first SS is taken then look for disclaimer in view - 24 hours
                    // TODO: After disclaimer SS is taken then look for Arrow/tabs - 24 hours
                    // TODO: After arrow/tabs is taken then look one last time for disclaimers - 24 hours
                    // TODO: After final disclaimer then look for modal buttons - 40 hours
                    // TODO: After modal opens then look for disclaimers in modal - 24 hours
                }
            }
            console.log('Section Done');
            // const element = await page.$('.tile-container');
            // await element.screenshot({ path: './public/screenshots/section.png' });
        }
        // TODO: Convert images to PDF - 24 hours
        // TODO: Give PDF to User and delete images from server - 24 hours
        // ----------------------

        // ----------------------
        // LAZY LOAD - Deprecated, it doesn't do what we need correctly
        // if (fullPage) {
        //     const bodyHandle = await page.$('.globalWrapper');
        //     const { height } = await bodyHandle.boundingBox();
        //     await bodyHandle.dispose();
        //     await page.screenshot({ path: './public/screenshots/test.jpg', type: 'jpeg', fullPage: false });

        //     // Scroll one viewport at a time, pausing to let content load
        //     // const viewportHeight = page.viewport().height;
        //     let viewportIncr = 0;
        //     let screenNum = 0;
        //     await page.screenshot({ path: './public/screenshots/scrolling/screen_' + screenNum + '.png' });
        //     await wait(2000);
        //     const viewportHeight = page.viewport().height;
        //     console.log(viewportHeight);

        //     while (viewportIncr + viewportHeight < height) {
        //         screenNum++;
        //         await page.evaluate(_viewportHeight => {
        //             window.scrollBy(0, _viewportHeight);
        //         }, viewportHeight);
        //         await wait(2000);
        //         viewportIncr = viewportIncr + viewportHeight;
        //         await page.screenshot({ path: './public/screenshots/screen_' + screenNum + '.png' });
        //     }
        // }
        // ----------------------

        await page.close();
        await browser.close();

        res.send('Screenshot taken for: ' + url); //req.query.url);

    } catch (err) {
        console.log(err);
        await page.close();
        await browser.close();
    }
}

router.get('/', function(req, res, next) {
    console.log('[LOG] Submitted URL: ' + req.query.url);
    SShot(res, next, req.query.url);
    // res.send('Screenshot taken for: ' + req.query.url); //req.query.url);
});

module.exports = router;