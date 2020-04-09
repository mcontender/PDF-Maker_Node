var express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs')
const imagesToPdf = require("images-to-pdf")
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

async function SShot(res, next, url, psw) {
    let browser = await puppeteer.launch({ headless: false, devtools: true });
    let page = await browser.newPage();
    let screenshotArray = new Array();

    // ----------------------
    //get brand from URL passed
    // ----------------------
    var brandUrl = await getPath(url);
    console.log("LOG : brand URL " + brandUrl);
    console.log("LOG : URL " + url);


    // ----------------------
    // set up cookie + encrypt + set up expiration
    var cookieValue = await b64_md5(psw);
    var cookieName = 'ac';
    var today = new Date();
    var expire = new Date();
    var nDays = 45;

    console.log("Brand PSW : " + psw);
    if (psw.length > 0) {
        if (url.indexOf('preview') >= 0 || url.indexOf('test') >= 0 || url.indexOf('uat') >= 0) {
            console.log("LOG: Preview Cookie Set Up!!!");
            // ----------------------
            //set expiration on cookie
            // ----------------------
            expire.setTime(today.getTime() + 3600000 * 24 * nDays);
            if (nDays == null || nDays == 0) { nDays = 45; }

            // ----------------------
            //set up cookie with objectr
            // ----------------------
            var cookiesVal = escape(cookieValue);
            const cookies = [{
                'name': 'ac',
                'value': cookiesVal,
                'domain': brandUrl
            }];

            // ----------------------
            //set cookies on page
            // ----------------------
            const cookiesSet = await page.cookies(brandUrl);
            await page.setCookie(...cookies);
            console.log(JSON.stringify(cookiesSet));


        } else {
            console.log("LOG: No Cookie Required!!!");
        }
    }


    // ----------------------
    // Debugging messages setup
    // ----------------------
    page.on('dialog', async dialog => {
        console.log(dialog.message())
        await dialog.dismiss()
    });

    // page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // console.log('PAGE LOG MSG :', msg);
    console.log('Page URL: ' + url);
    try {
        // ----------------------
        // Create directory after checking if directory is available
        // ----------------------
        var date = new Date();
        var dir = './public/screenshots/' + date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
        // console.log('Directory: ' + dir);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // ----------------------
        // Set page settings and create a new tab
        // ----------------------
        await page.setViewport({ width: 1920, height: 1080 });
        // make sure all JS is loaded and all Ajax requests are done.
        let cookiesSet = await page.cookies(url);
        let result;

        // await page.goto(url, { waitUntil: 'networkidle0' });

        try {
            result = await page.goto(url, { waitUntil: 'networkidle0' });
            console.info('No error thrown')

            if (result.status() === 403) {
                console.error('403 status code found in result')
            }
        } catch (err) {
            console.error('Error thrown')
        }
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
        // create hero file name to add to lazyload array
        var heroScreenShot = './public/screenshots/scrolling/screen_' + screenNum + '.png';

        await page.screenshot({ path: './public/screenshots/scrolling/screen_' + screenNum + '.png' });
        await wait(2000);
        const viewportHeight = page.viewport().height + 20;
        let lazyLoadPath = './public/screenshots/scrolling/';
        let lazyLoadArr = new Array();

        lazyLoadArr.push(heroScreenShot);


        console.log('Lazy Load: starting');

        // ----------------------
        // Loop enough times where there is no more height and we know we have gotten to the bottom of the page
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
            // create lady load file name and store it in array
            var fileNameLazyload = lazyLoadPath + screenNum + '.png';
            lazyLoadArr.push(fileNameLazyload);

            await page.screenshot({ path: lazyLoadPath + screenNum + '.png' });

        }
        // send lazyloadArray items to be deleted
        await deleteFiles(lazyLoadArr, function(err) {
            if (err) {
                console.log(err);
            } else {
                console.log('all lazy load files removed');
            }
        });


        console.log('Lazy Load: end');
        // Lazy Load END -----------------------------
        console.log('Children Elements: start finding')

        // ----------------------
        // execute standard javascript in the context of the page.
        // const stories = await page.evaluate('.parsys', sections => { return $('.parsys').children });
        const sections = await page.evaluate(() => {
            var results = Array.from($('.parsys').children());
            if (results.length == 0) {
                results = Array.from($('.gcss-main-content').children());
            }
            // debugger;
            var childrenOfChildrenID = Array(results.length);
            console.log('Children Elements: loop for more');
            // ----------------------
            // Get list of modules in the parsys container on the page only
            // header, footer, hero sections will not be under this container
            for (var x = 0; x < results.length; x++) {
                // console.log('children elements: ele = ' + document.querySelectorAll('.' + results[x].className.split(' ')[0])[0].children[0]);
                // console.log('Loop ID: ' + x);

                // TODO: Check for 0 level id and 1 level id and 2 level id max
                // results[x].customClass = $(results[x]).addClass('pdf-module-' + x);

                // console.log('ChildID: ' + $(results[x]).children().eq(0).attr('id'));
                if ($(results[x]).children().eq(0).attr('id') != '') {
                    childrenOfChildrenID[x] = $(results[x]).children().eq(0).attr('id');
                    results[x].childs = childrenOfChildrenID[x];
                    // debugger;
                    // console.log('childrenOfChildrenID: ' + childrenOfChildrenID);
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
                    offTop: result.offsetTop,
                    customClass: result.customClass
                }
            });
        });

        // ----------------------
        // Get full HTML
        // const source = await page.content();
        // console.log(stories);

        // var element = await page.$('.hero');
        // ----------------------
        // Take Hero screenshot since its not part of the parsys container
        // var heroPath = dir + '/section_0-hero.png';
        // console.log(heroPath);
        // await element.screenshot({ path: heroPath });
        // screenshotArray.push(heroPath);
        if (await page.$('.hero') !== null) {
            console.log('hero found');
            page.$eval('.hero', (el) => el.scrollIntoView())
            await arrowCheck(-1, '.hero', page, dir, screenshotArray);
            console.log("hero 1");
        } else {
            console.log('hero not found');
        };

        // ----------------------
        // Loop through each module that we found in the parsys container and scroll them into view to make sure they are in the screenshot correctly
        var eleLookup = '';
        console.log('trigger sections');
        console.log('sections: ' + sections);
        for (var i = 0; i < sections.length; i++) {
            console.log('--------------------------------------------------');
            console.log('Section Data: ');
            console.log(sections[i]);
            // console.log('Sections: Childs ' + i + ' (' + sections[i].childs + ')');
            // console.log(sections[i].class.toString().split(' ')[0]);

            // ----------------------
            // Scroll the module into view based on 3 variations of id or class combinations
            if (!sections[i].class.includes('open-container')) {
                // if (sections[i].childID != undefined) {
                //     // console.log('Sections: ChildID Used');
                //     page.$eval('#' + sections[i].childID, (el) => el.scrollIntoView())
                //     eleLookup = '#' + sections[i].childID;
                //     await wait(500);
                // } else 
                if (sections[i].id != '') {
                    // console.log('Sections: ID Used');
                    page.$eval('#' + sections[i].id, (el) => el.scrollIntoView())
                    eleLookup = '#' + sections[i].id;
                    await wait(500);
                } else {
                    // console.log('Sections: Class Used');
                    page.$eval('.' + sections[i].class.toString().split(' ')[0], (el) => el.scrollIntoView())
                    eleLookup = '.' + sections[i].class.toString().split(' ')[0];
                    await wait(500);
                }

                // ----------------------
                // Always close the last one from the loop
                // ----------------------
                // console.log('**Always Try To Close Disclaimer First**');

                closeDisclaimer(page);
                await wait(500);

                // ----------------------
                // Take the module screenshot and save it under sections
                // ----------------------
                var fileName = dir + '/section_' + (i + 1) + '-0.png';
                await page.screenshot({ path: fileName });
                screenshotArray.push(fileName);
                // console.log('screenshot taken:');
                await wait(500);

                // ----------------------
                // Check for disclaimer child elements in module we just SS
                // ----------------------

                if (eleLookup != '.feature-carousel') {
                    await disclaimerCheck(i, eleLookup, page, dir, screenshotArray, 0);
                }
                // ----------------------
                // Check for arrow child elements in module we just SS
                // ----------------------
                await arrowCheck(i, eleLookup, page, dir, screenshotArray);

                // TODO: After final disclaimer then look for modal buttons - 40 hours
                // TODO: After modal opens then look for disclaimers in modal - 24 hours

                await featureCarouselTabs(-1, eleLookup, page, dir, screenshotArray);

            }
        }
        // console.log('Section Done');
        // TODO: Give PDF to User and delete images from server - 24 hours

        // ----------------------
        // lets make sure we close the page/tab and then the browser we created.
        await page.close();
        await browser.close();
        console.log("screenshot arrray = ", screenshotArray);
        if (screenshotArray.length > 0) {
            await imagesToPdf(screenshotArray, dir + "/combined.pdf");
            // ----------------------
            res.send('Screenshot taken for: ' + url + '<br><br> Download PDF' + '<a href=' + dir + '/combined.pdf' + '>LINK</a>');

            // Send a response to the original request that we are done taking screenshots
            // res.send('Screenshot taken for: ' + url); //req.query.url);
            // Send Screenshot array to be deleted.

            await deleteFiles(screenshotArray, function(err) {
                if (err) {
                    console.log(err);
                } else {
                    console.log('all files removed');
                }
            });


        } else {
            console.log('no screenshots so no directory or PDF');
        }

    } catch (err) {
        // ----------------------
        // If anyhting goes wrong lets make sure we close the page/tab and then the browser we created.
        console.log(err);
        await page.close();
        await browser.close();
    }
}

async function disclaimerCheck(i, eleLookup, page, dir, screenshotArray, y, childElement) {
    // ----------------------
    // Check for disclaimer child elements in module we just SS
    // ----------------------
    var disclaimerListLength;
    // console.log(childElement);
    // console.log(childElement == undefined);
    console.log('disclaimerCheck Function()');
    // ----------------------
    // Check if we have a childElement (Hero Panels)
    if (childElement != undefined) {
        if (childElement.length > 0) {
            disclaimerListLength = await page.evaluate(({ eleLookup, y, childElement }) => {
                var list = new Array();
                list = $(eleLookup).find(childElement).eq(y).find('.disclosure-bubble-wrapper .bubble');
                // debugger;
                return list.length;
            }, { eleLookup, y, childElement });
        }
    }
    // ----------------------
    // If no child elements check normally (Lineup/Promo Tiles)
    else {
        disclaimerListLength = await page.evaluate((eleLookup) => {
            var list = new Array();
            // debugger;
            list = $(eleLookup).find('.disclosure-bubble-wrapper .bubble');
            return list.length;
        }, eleLookup);
    }


    // ----------------------
    // Click Disclaimer
    // Check if in view and then click to open it
    // ----------------------
    console.log('(Disclaimer) eleLookup: 1 ' + eleLookup);
    console.log('disclaimerListLength', disclaimerListLength);
    // console.log('(Disclaimer) disclaimerList: ' + disclaimerListLength);
    for (let x = 0; x < disclaimerListLength; x++) {
        const disclaimerOpen = await page.evaluate(({ eleLookup, x, childElement, y }) => {
            // ----------------------
            // Check if disclaimer is in viewport
            // ----------------------
            // debugger;
            var ele;
            var bubbleWrapper;
            // ----------------------
            // Check if we have a childElement (Hero Panels)
            if (childElement != undefined) {
                if (childElement.length > 0) {
                    // ele = $(eleLookup).find(childElement).eq(y).find('.disclosure-bubble-wrapper .bubble')[x];

                    bubbleWrapper = $(eleLookup).find(childElement).eq(y).find('.disclosure-bubble-wrapper')[x];
                    ele = $(bubbleWrapper).find('.bubble');
                    // debugger;
                }
            }
            // ----------------------
            // If no child elements check normally (Lineup/Promo Tiles)
            else {
                console.log('undefined else childElement.length > 0');
                ele = $(eleLookup).find('.disclosure-bubble-wrapper .bubble')[x];

            }
            // var elementBounding = ele.getBoundingClientRect();
            // var elementTop = elementBounding.top + window.scrollY;
            // var elementBottom = elementTop + elementBounding.height;
            // var viewportTop = window.scrollY;
            // var viewportBottom = viewportTop + window.outerHeight;
            // // console.log('ele', ele);


            // ----------------------
            // Click disclaimer if in view
            // ----------------------
            //debugger;
            ele.click();
            $('#disclosure-panel-wrapper .disclosure-panel-wrapper').addClass('show');
            // if (elementBottom > viewportTop && elementTop < viewportBottom) {

            //     return true;
            // }
        }, { eleLookup, x, childElement, y });
        await wait(500);

        // ----------------------
        // Take the module screenshot and save it under sections
        // ----------------------
        if (y == 0) {
            var fileName = dir + '/section_' + (i + 1) + '-disclaimer-' + (x + 1) + '.png';
            console.log('Y==0');
        } else {
            var fileName = dir + '/section_' + (i + 1) + '-' + y + '-disclaimer-' + (x + 1) + '.png';
            console.log('else Y==0');
        }
        await page.screenshot({ path: fileName });
        screenshotArray.push(fileName);
        await wait(500);
        // ----------------------
        // Close Disclaimer box if it was open
        // ----------------------
        // Global function to close disclaimer
        closeDisclaimer(page);
        console.log('(Disclaimer) **Next Disclaimer**');
    }
}

async function arrowCheck(i, eleLookup, page, dir, screenshotArray) {
    // ----------------------
    // Always close the last one from the loop
    // ----------------------
    console.log('arrowCheck Function()');

    closeDisclaimer(page);
    await wait(500);

    // ----------------------
    // Check for arrows and pagination dots
    // ----------------------
    const arrowListLength = await page.evaluate((eleLookup) => {
        var list = new Array();
        var pagination = new Array();
        // .arrow works for hero carousel
        list = $(eleLookup).find('.arrow.right').length;
        pagination = $(eleLookup).find('.meatball').length;
        // debugger;
        return {
            arrowNum: list,
            paginationNum: pagination
        }
    }, eleLookup);

    console.log('arrowListLength', arrowListLength);
    // ----------------------
    // Take the initial module screenshot and save it under sections
    // ----------------------
    // var fileName = dir + '/section_' + (i + 1) + '.png';
    // await page.screenshot({ path: fileName });
    // screenshotArray.push(fileName);
    // await wait(500);
    // ----------------------
    // Close Arrow box if it was open
    // ----------------------
    // await disclaimerCheck(i, eleLookup, page, dir, screenshotArray, 0);
    // await wait(500);

    // ----------------------
    // Click arrow
    // Check if in view and then click to open it
    // ----------------------
    if (arrowListLength.paginationNum > 0) {
        for (let y = 0; y < arrowListLength.paginationNum; y++) {
            console.log('--------------------------------------------------');
            console.log('(Arrow) eleLookup: ' + eleLookup);
            console.log('(Arrow) Loop ID: ' + y);
            console.log('(Arrow) arrowList - arrowNum: ' + arrowListLength.arrowNum);
            console.log('(Arrow) arrowList - pagination: ' + arrowListLength.paginationNum);
            await arrowLogic(i, y, eleLookup, page, dir, screenshotArray, arrowListLength);
        }
    } else if (arrowListLength.arrowNum > 0) {
        console.log('--------------------------------------------------');
        console.log('(Arrow) eleLookup: ' + eleLookup);
        console.log('(Arrow) arrowList - arrowNum: ' + arrowListLength.arrowNum);
        console.log('(Arrow) arrowList - pagination: ' + arrowListLength.paginationNum);
        await arrowLogic(i, 0, eleLookup, page, dir, screenshotArray, arrowListLength);
    }
}

async function arrowLogic(i, y, eleLookup, page, dir, screenshotArray, arrowListLength) {

    // ----------------------
    // Take the module screenshot and save it under sections
    // ----------------------
    var fileName = dir + '/section_' + (i + 1) + '-arrow-' + (y + 1) + '.png';
    await page.screenshot({ path: fileName });
    screenshotArray.push(fileName);
    await wait(500);
    // ----------------------
    //  Check if we have pagination dots and if so run disclaimer check before proceeding
    // ----------------------
    if (arrowListLength.paginationNum > 0) {
        // var temp = $(eleLookup).find('.carousel-item');
        // var carouselItem = await page.evaluate(({ eleLookup, y }) => {
        //     var ele = $(eleLookup).find('.carousel-item').eq(y)[0];
        //     debugger;
        //     // return $(ele);
        //     return {
        //         childClass: '.carousel-item',
        //         id
        //     }
        // }, { eleLookup, y });
        await disclaimerCheck(i, eleLookup, page, dir, screenshotArray, y, '.carousel-item');
    } else {
        await disclaimerCheck(i, eleLookup, page, dir, screenshotArray, y);
    }
    await wait(500);

    // for (let x = 0; x < arrowListLength.arrowNum; x++) {
    const arrowOpen = await page.evaluate(({ eleLookup }) => {
        // ----------------------
        // Check if arrow is in viewport
        // ----------------------
        // console.log('(Arrow/ArrowLogic) eleLookup: ' + eleLookup);
        var ele = $(eleLookup).find('.arrow.right');
        // var elementBounding = ele[0].getBoundingClientRect();
        // var elementTop = elementBounding.top + window.scrollY;
        // var elementBottom = elementTop + elementBounding.height;
        // var viewportTop = window.scrollY;
        // var viewportBottom = viewportTop + window.outerHeight;
        // debugger;
        // ----------------------
        // Click arrow if in view
        // ----------------------
        // console.log('---------------------');
        // console.log('(ARROW) Is the Arrow in view: ' + (elementBottom > viewportTop && elementTop < viewportBottom));
        // console.log('(ARROW) viewportTop: ' + viewportTop);
        // console.log('(ARROW) elementBottom: ' + elementBottom);
        // console.log('(ARROW) elementTop: ' + elementTop);
        // console.log('(ARROW) viewportBottom: ' + viewportBottom);
        // if (elementBottom > viewportTop && elementTop < viewportBottom) {
        ele.find('a')[0].click();
        // console.log('(ARROW) Arrow click element: ' + ele.find('a')[0]);
        return true;
        // }
    }, { eleLookup });
    await wait(500);

    console.log('(Arrow/ArrowLogic) **Next Pagination**');
    // }
}

async function featureCarouselTabs(i, eleLookup, page, dir, screenshotArray) {

    // closeDisclaimer(page);
    // check to see how many tabs are in module

    const tabsLength = await page.evaluate((eleLookup) => {
        var tabTotal = $(eleLookup).find('.tab-list').children().length;

        // debugger;
        return {
            tabs: tabTotal
        }
    }, eleLookup);

    /// Loop though the tabs
    if (tabsLength.tabs > 0) {
        for (let y = 0; y < tabsLength.tabs; y++) {
            // ----------------------
            // Take the module screenshot and save it under sections

            var fileName = dir + '/section_' + (i + 1) + '-feature-carousel-tab-' + (y + 1) + '.png';
            var currentTab = y;
            const tabClick = await page.evaluate(({ eleLookup, currentTab }) => {
                // ----------------------
                // Check if TAB is in viewport
                // debugger;
                // ----------------------
                var ele = $(eleLookup).find('.tab-list');

                ele.find('a')[currentTab].click();
                // console.log('(TAB) TAB click element: ' + ele.find('a')[0]);
                return true;
                // }
            }, { eleLookup, currentTab });
            await wait(500);

            console.log('(feature-carousel :: tabs capture) ** Next TAB ===>');

            await page.screenshot({ path: fileName });
            // if its the first screenshot, don't save it since its being taking care of by sections
            if (y != 0) {
                screenshotArray.push(fileName);
            }
            await wait(500);
            // ----------------------
            //  Check if we have tabs and if so run disclaimer check before proceeding
            // ----------------------
            // debugger;
            if (tabsLength.tabs > 0) {

                await disclaimerCheck(i, eleLookup, page, dir, screenshotArray, y, '.tablist-tab-content');
            } else {
                await disclaimerCheck(i, eleLookup, page, dir, screenshotArray, y);
            }
            await wait(500);
            closeDisclaimer(page);

        }


    }

}

async function closeDisclaimer(page) {
    const disclaimerClose = await page.evaluate(() => {
        console.log('closeDisclaimer FUNCTION ');
        $('#disclosure-panel-wrapper').find('.ucx-close-button').click();
        $('#disclosure-panel-wrapper .disclosure-panel-wrapper').removeClass('show');
        // console.log('Close Button: ' + $('#disclosure-panel-wrapper').find('.ucx-close-button').length);
        // console.log('**close disclaimer - outside loop**');
        //debugger;
    });
    await wait(500);
}



// ----------------------
// This route triggers the above function for screen-shotting when there is a get request and there are query parameters passed
router.get('/', function(req, res, next) {
    console.log('[LOG] Submitted URL: ' + req.query.url);
    // TODO: check if URL is valid and if not don't call the SShot function
    console.log('[LOG] Submitted PSW : ' + req.query.psw);
    SShot(res, next, req.query.url, req.query.psw);
});

module.exports = router;


// ----------------------
//
// DELETE IMAGES ONCE PDF HAS BEEN CREATED.
//
// ----------------------

function deleteFiles(files, callback) {
    var i = files.length;
    files.forEach(function(filepath) {
        fs.unlink(filepath, function(err) {
            i--;
            if (err) {
                callback(err);
                return;
            } else if (i <= 0) {
                callback(null);
            }
        });
    });
}

// ----------------------
//get brand from url passed on form

function getPath(url) {

    var temp = "." + url.match(/[^(?:http:\/\/|www\.|https:\/\/|www\-preview)\.|uat\.|preview\.|test\.)]([^\/]+)(com)/g);
    return temp;
}

// ----------------------
//
// PASSWORD FUNCTIONS.
//
// ----------------------

/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0; /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad = ""; /* base-64 pad character. "=" for strict RFC compliance   */
var chrsz = 8; /* bits per input character. 8 - ASCII; 16 - Unicode      */

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_md5(s) { return binl2hex(core_md5(str2binl(s), s.length * chrsz)); }

function b64_md5(s) { return binl2b64(core_md5(str2binl(s), s.length * chrsz)); }

function str_md5(s) { return binl2str(core_md5(str2binl(s), s.length * chrsz)); }

function hex_hmac_md5(key, data) { return binl2hex(core_hmac_md5(key, data)); }

function b64_hmac_md5(key, data) { return binl2b64(core_hmac_md5(key, data)); }

function str_hmac_md5(key, data) { return binl2str(core_hmac_md5(key, data)); }

/*
 * Perform a simple self-test to see if the VM is working
 */
function md5_vm_test() {
    return hex_md5("abc") == "900150983cd24fb0d6963f7d28e17f72";
}

/*
 * Calculate the MD5 of an array of little-endian words, and a bit length
 */
function core_md5(x, len) {
    /* append padding */
    x[len >> 5] |= 0x80 << ((len) % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;

    var a = 1732584193;
    var b = -271733879;
    var c = -1732584194;
    var d = 271733878;

    for (var i = 0; i < x.length; i += 16) {
        var olda = a;
        var oldb = b;
        var oldc = c;
        var oldd = d;

        a = md5_ff(a, b, c, d, x[i + 0], 7, -680876936);
        d = md5_ff(d, a, b, c, x[i + 1], 12, -389564586);
        c = md5_ff(c, d, a, b, x[i + 2], 17, 606105819);
        b = md5_ff(b, c, d, a, x[i + 3], 22, -1044525330);
        a = md5_ff(a, b, c, d, x[i + 4], 7, -176418897);
        d = md5_ff(d, a, b, c, x[i + 5], 12, 1200080426);
        c = md5_ff(c, d, a, b, x[i + 6], 17, -1473231341);
        b = md5_ff(b, c, d, a, x[i + 7], 22, -45705983);
        a = md5_ff(a, b, c, d, x[i + 8], 7, 1770035416);
        d = md5_ff(d, a, b, c, x[i + 9], 12, -1958414417);
        c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
        b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = md5_ff(a, b, c, d, x[i + 12], 7, 1804603682);
        d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
        c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
        b = md5_ff(b, c, d, a, x[i + 15], 22, 1236535329);

        a = md5_gg(a, b, c, d, x[i + 1], 5, -165796510);
        d = md5_gg(d, a, b, c, x[i + 6], 9, -1069501632);
        c = md5_gg(c, d, a, b, x[i + 11], 14, 643717713);
        b = md5_gg(b, c, d, a, x[i + 0], 20, -373897302);
        a = md5_gg(a, b, c, d, x[i + 5], 5, -701558691);
        d = md5_gg(d, a, b, c, x[i + 10], 9, 38016083);
        c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
        b = md5_gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = md5_gg(a, b, c, d, x[i + 9], 5, 568446438);
        d = md5_gg(d, a, b, c, x[i + 14], 9, -1019803690);
        c = md5_gg(c, d, a, b, x[i + 3], 14, -187363961);
        b = md5_gg(b, c, d, a, x[i + 8], 20, 1163531501);
        a = md5_gg(a, b, c, d, x[i + 13], 5, -1444681467);
        d = md5_gg(d, a, b, c, x[i + 2], 9, -51403784);
        c = md5_gg(c, d, a, b, x[i + 7], 14, 1735328473);
        b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

        a = md5_hh(a, b, c, d, x[i + 5], 4, -378558);
        d = md5_hh(d, a, b, c, x[i + 8], 11, -2022574463);
        c = md5_hh(c, d, a, b, x[i + 11], 16, 1839030562);
        b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = md5_hh(a, b, c, d, x[i + 1], 4, -1530992060);
        d = md5_hh(d, a, b, c, x[i + 4], 11, 1272893353);
        c = md5_hh(c, d, a, b, x[i + 7], 16, -155497632);
        b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
        a = md5_hh(a, b, c, d, x[i + 13], 4, 681279174);
        d = md5_hh(d, a, b, c, x[i + 0], 11, -358537222);
        c = md5_hh(c, d, a, b, x[i + 3], 16, -722521979);
        b = md5_hh(b, c, d, a, x[i + 6], 23, 76029189);
        a = md5_hh(a, b, c, d, x[i + 9], 4, -640364487);
        d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
        c = md5_hh(c, d, a, b, x[i + 15], 16, 530742520);
        b = md5_hh(b, c, d, a, x[i + 2], 23, -995338651);

        a = md5_ii(a, b, c, d, x[i + 0], 6, -198630844);
        d = md5_ii(d, a, b, c, x[i + 7], 10, 1126891415);
        c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
        b = md5_ii(b, c, d, a, x[i + 5], 21, -57434055);
        a = md5_ii(a, b, c, d, x[i + 12], 6, 1700485571);
        d = md5_ii(d, a, b, c, x[i + 3], 10, -1894986606);
        c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
        b = md5_ii(b, c, d, a, x[i + 1], 21, -2054922799);
        a = md5_ii(a, b, c, d, x[i + 8], 6, 1873313359);
        d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
        c = md5_ii(c, d, a, b, x[i + 6], 15, -1560198380);
        b = md5_ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = md5_ii(a, b, c, d, x[i + 4], 6, -145523070);
        d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
        c = md5_ii(c, d, a, b, x[i + 2], 15, 718787259);
        b = md5_ii(b, c, d, a, x[i + 9], 21, -343485551);

        a = safe_add(a, olda);
        b = safe_add(b, oldb);
        c = safe_add(c, oldc);
        d = safe_add(d, oldd);
    }
    return Array(a, b, c, d);

}

/*
 * These functions implement the four basic operations the algorithm uses.
 */
function md5_cmn(q, a, b, x, s, t) {
    return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
}

function md5_ff(a, b, c, d, x, s, t) {
    return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}

function md5_gg(a, b, c, d, x, s, t) {
    return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}

function md5_hh(a, b, c, d, x, s, t) {
    return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}

function md5_ii(a, b, c, d, x, s, t) {
    return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
}

/*
 * Calculate the HMAC-MD5, of a key and some data
 */
function core_hmac_md5(key, data) {
    var bkey = str2binl(key);
    if (bkey.length > 16) bkey = core_md5(bkey, key.length * chrsz);

    var ipad = Array(16),
        opad = Array(16);
    for (var i = 0; i < 16; i++) {
        ipad[i] = bkey[i] ^ 0x36363636;
        opad[i] = bkey[i] ^ 0x5C5C5C5C;
    }

    var hash = core_md5(ipad.concat(str2binl(data)), 512 + data.length * chrsz);
    return core_md5(opad.concat(hash), 512 + 128);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y) {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt) {
    return (num << cnt) | (num >>> (32 - cnt));
}

/*
 * Convert a string to an array of little-endian words
 * If chrsz is ASCII, characters >255 have their hi-byte silently ignored.
 */
function str2binl(str) {
    var bin = Array();
    var mask = (1 << chrsz) - 1;
    for (var i = 0; i < str.length * chrsz; i += chrsz)
        bin[i >> 5] |= (str.charCodeAt(i / chrsz) & mask) << (i % 32);
    return bin;
}

/*
 * Convert an array of little-endian words to a string
 */
function binl2str(bin) {
    var str = "";
    var mask = (1 << chrsz) - 1;
    for (var i = 0; i < bin.length * 32; i += chrsz)
        str += String.fromCharCode((bin[i >> 5] >>> (i % 32)) & mask);
    return str;
}

/*
 * Convert an array of little-endian words to a hex string.
 */
function binl2hex(binarray) {
    var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
    var str = "";
    for (var i = 0; i < binarray.length * 4; i++) {
        str += hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF) +
            hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xF);
    }
    return str;
}

/*
 * Convert an array of little-endian words to a base-64 string
 */
function binl2b64(binarray) {
    var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var str = "";
    for (var i = 0; i < binarray.length * 4; i += 3) {
        var triplet = (((binarray[i >> 2] >> 8 * (i % 4)) & 0xFF) << 16) |
            (((binarray[i + 1 >> 2] >> 8 * ((i + 1) % 4)) & 0xFF) << 8) |
            ((binarray[i + 2 >> 2] >> 8 * ((i + 2) % 4)) & 0xFF);
        for (var j = 0; j < 4; j++) {
            if (i * 8 + j * 6 > binarray.length * 32) str += b64pad;
            else str += tab.charAt((triplet >> 6 * (3 - j)) & 0x3F);
        }
    }
    return str;
}