var express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs')
var router = express.Router();

function wait(ms) {
    return new Promise(resolve => setTimeout(() => resolve(), ms));
}

function isInViewport(ele, windowScrollY, windowHeight) {
    var elementBounding = document.querySelector(ele).getBoundingClientRect();
    var elementTop = elementBounding.top + windowScrollY;
    var elementBottom = elementTop + document.querySelector(ele).outerHeight();
    console.log('elementBounding: ' + elementBounding);
    console.log('elementTop: ' + elementTop);
    console.log('elementBottom: ' + elementBottom);
    var viewportTop = windowScrollY;
    var viewportBottom = viewportTop + windowHeight;

    return elementBottom > viewportTop && elementTop < viewportBottom;
};

async function SShot(res, next, url) {
    let browser = await puppeteer.launch({ headless: false, devtools: true });
    let page = await browser.newPage();
    page.on('dialog', async dialog => {
        console.log(dialog.message())
        await dialog.dismiss()
    });
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    // let fullPage = false;
    console.log('Page URL: ' + url);
    try {
        // ----------------------
        // Create directory after checking if directory is available
        // ----------------------
        var date = new Date();
        var dir = './public/screenshots/' + date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
        console.log('Directory: ' + dir);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // TODO: open and setup monthly cookie
        // ----------------------
        // Set page settings and create a new tab
        // ----------------------
        await page.setViewport({ width: 1920, height: 1080 });
        // make sure all JS is loaded and all Ajax requests are done.
        await page.goto(url, { waitUntil: 'networkidle2' });
        await page.emulateMedia('screen');


        // -----------------------------
        // Lazy Load Page first
        // -----------------------------
        const bodyHandle = await page.$('.gcss-page');
        const { height } = await bodyHandle.boundingBox();
        console.log('Page length: ' + Math.floor(height) + 'px');
        if (height < 1080) {
            bodyHandle = await page.$('.globa-wrapper');
        }
        await bodyHandle.dispose();

        // ----------------------
        // Scroll one viewport at a time, pausing to let content load
        let viewportIncr = 0;
        let screenNum = 0;
        // ----------------------
        // we have to take a screenshot to force the page to load
        await page.screenshot({ path: './public/screenshots/scrolling/screen_' + screenNum + '.png' });
        await wait(2000);
        const viewportHeight = page.viewport().height + 20;
        console.log('Lazy Load: starting');

        // ----------------------
        // Loop enoght times where there is no more height and we know we have gotten to the bottom of the page
        // This loops based on the viewport height 
        while (viewportIncr + viewportHeight < height) {
            screenNum++;
            await page.evaluate(_viewportHeight => {
                window.scrollBy(0, _viewportHeight);
            }, viewportHeight);
            await wait(2000);
            viewportIncr = viewportIncr + viewportHeight;
            // ----------------------
            // we have to take a screenshot to force the page to load
            await page.screenshot({ path: './public/screenshots/scrolling/screen_' + screenNum + '.png' });
        }
        console.log('Lazy Load: end');
        // Lazy Load END -----------------------------
        console.log('Children Elements: start finding')

        // ----------------------
        // execute standard javascript in the context of the page.
        // const stories = await page.evaluate('.parsys', sections => { return $('.parsys').children });
        const sections = await page.evaluate(() => {
            var results = Array.from($('.parsys').children())
            var childrenOfChildrenID = Array(results.length);
            console.log('Children Elements: loop for more');
            // ----------------------
            // Get list of modules in the parsys cotainer on the page only
            // header, footer, hero sections will not be under this contianer
            for (var x = 0; x < results.length; x++) {
                // console.log('children elements: ele = ' + document.querySelectorAll('.' + results[x].className.split(' ')[0])[0].children[0]);
                console.log('Loop ID: ' + x);
                console.log('ChildID: ' + $(results[x]).children().eq(0).attr('id'));
                if ($(results[x]).children().eq(0).attr('id') != '') {
                    childrenOfChildrenID[x] = $(results[x]).children().eq(0).attr('id');
                    results[x].childs = childrenOfChildrenID[x];
                    console.log('childrenOfChildrenID: ' + childrenOfChildrenID);
                }

            }
            // ----------------------
            // Create a JS object of as much data as we can get so that we can use it later when we need to know what module we are checking
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
        });

        // ----------------------
        // Get full HTML
        // const source = await page.content();
        // console.log(stories);

        var element;
        // ----------------------
        // Take Hero screenshot since its not part of the parsys container
        element = await page.$('.hero');
        await element.screenshot({ path: './public/screenshots/sections/section_0.png' });

        // ----------------------
        // Loop through each module that we found in the parsys container and scroll them into view to make sure they are in the screenshot correctly
        var eleLookup = '';

        for (var i = 0; i < sections.length; i++) {
            console.log('--------------------------------------------------');
            console.log('Section Data: ');
            console.log(sections[i]);
            // console.log('Sections: Childs ' + i + ' (' + sections[i].childs + ')');
            // console.log(sections[i].class.toString().split(' ')[0]);

            // ----------------------
            // Scroll the module into view based on 3 variations of id or class combinations
            if (!sections[i].class.includes('open-container')) {
                if (sections[i].childID != undefined) {
                    // console.log('Sections: ChildID Used');
                    page.$eval('#' + sections[i].childID, (el) => el.scrollIntoView())
                    eleLookup = '#' + sections[i].childID;
                    await wait(1000);
                } else if (sections[i].id != '') {
                    // console.log('Sections: ID Used');
                    page.$eval('#' + sections[i].id, (el) => el.scrollIntoView())
                    eleLookup = '#' + sections[i].id;
                    await wait(1000);
                } else {
                    // console.log('Sections: Class Used');
                    page.$eval('.' + sections[i].class.toString().split(' ')[0], (el) => el.scrollIntoView())
                    eleLookup = '.' + sections[i].class.toString().split(' ')[0];
                    await wait(1000);
                }

                // ----------------------
                // Always close the last one from the loop
                // ----------------------
                console.log('**Always Try To Close Disclaimer First**');
                const disclaimerClose = await page.evaluate(() => {
                    $('#disclosure-panel-wrapper').find('.ucx-close-button').click();
                    $('#disclosure-panel-wrapper .disclosure-panel-wrapper').removeClass('show');
                    console.log('Close Button: ' + $('#disclosure-panel-wrapper').find('.ucx-close-button').length);
                    console.log('**close disclaimer - outside loop**');
                    // debugger;
                });
                await wait(1000);

                // ----------------------
                // Take the module screenshot and save it under sections
                // ----------------------
                var fileName = dir + '/section_' + (i + 1) + '-0.png';
                await page.screenshot({ path: fileName });
                console.log('screenshot taken:');
                await wait(1000);

                // ----------------------
                // Check for disclaimer child elements in module we just SS
                // ----------------------
                const disclaimerListLength = await page.evaluate((eleLookup) => {
                    var list = new Array();
                    list = $(eleLookup).find('.disclosure-bubble-wrapper .bubble');
                    return list.length;
                }, eleLookup);

                // ----------------------
                // Click Disclaimer
                // Check if in view and then click to open it
                // ----------------------
                console.log('eleLookup: ' + eleLookup);
                console.log("disclaimerList: " + disclaimerListLength);
                for (let x = 0; x < disclaimerListLength; x++) {
                    const disclaimerOpen = await page.evaluate(({ eleLookup, x }) => {
                        // ----------------------
                        // Check if disclaimer is in viewport
                        // ----------------------
                        console.log(eleLookup);
                        var ele = $(eleLookup).find('.disclosure-bubble-wrapper .bubble')[x];
                        var elementBounding = ele.getBoundingClientRect();
                        var elementTop = elementBounding.top + window.scrollY;
                        var elementBottom = elementTop + elementBounding.height;
                        var viewportTop = window.scrollY;
                        var viewportBottom = viewportTop + window.outerHeight;

                        // ----------------------
                        // Click disclaimer if in view
                        // ----------------------
                        if (elementBottom > viewportTop && elementTop < viewportBottom) {
                            ele.click();
                            return true;
                        }
                    }, { eleLookup, x });
                    await wait(1000);
                    // ----------------------
                    // Take the module screenshot and save it under sections
                    // ----------------------
                    var fileName = dir + '/section_' + (i + 1) + '-' + (x + 1) + '.png';
                    await page.screenshot({ path: fileName });
                    await wait(1000);
                    // ----------------------
                    // Close Disclaimer box if it was open
                    // ----------------------
                    const disclaimerClose = await page.evaluate(() => {
                        $('#disclosure-panel-wrapper').find('.ucx-close-button').click();
                        console.log('**close disclaimer - inside loop**');
                    });
                    console.log('**Next Disclaimer**');
                }
                // ----------------------

                // TODO: After disclaimer SS is taken then look for Arrow/tabs - 24 hours
                // TODO: After arrow/tabs is taken then look one last time for disclaimers - 24 hours
                // TODO: After final disclaimer then look for modal buttons - 40 hours
                // TODO: After modal opens then look for disclaimers in modal - 24 hours
            }
        }
        console.log('Section Done');
        // TODO: Convert images to PDF - 24 hours
        // TODO: Give PDF to User and delete images from server - 24 hours

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

        // ----------------------
        // lets make sure we close the page/tab and then the browser we created.
        await page.close();
        await browser.close();
        // ----------------------
        // Send a response to the original request that we are done taking screenshots
        res.send('Screenshot taken for: ' + url); //req.query.url);

    } catch (err) {
        // ----------------------
        // If anyhting goes wrong lets make sure we close the page/tab and then the browser we created.
        console.log(err);
        await page.close();
        await browser.close();
    }
}

// ----------------------
// This route triggers the above function for screenshotting when there is a get request and there are query paramets passed
router.get('/', function(req, res, next) {
    console.log('[LOG] Submitted URL: ' + req.query.url);
    // TODO: check if URL is valid and if not don't call the SShot function
    SShot(res, next, req.query.url);
});

module.exports = router;