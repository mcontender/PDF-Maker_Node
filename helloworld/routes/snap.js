var express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs')
var router = express.Router();
var chrsz = 8; /* bits per input character. 8 - ASCII; 16 - Unicode      */
var hexcase = 0; /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad = ""; /* base-64 pad character. "=" for strict RFC compliance   */

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

    // ----------------------
    // set up cookie + encrypt + set up expiration

    var cookieValue = await b64_md5(psw);
    var cookieName = 'ac';
    var today = new Date();
    var expire = new Date();
    var nDays = 45;

    // ----------------------
    //get brand from URL passed

    var brandUrl = await getPath(url);

    console.log("LOG : brand URL " + brandUrl);

    // ----------------------
    //set expiration on cookie
    expire.setTime(today.getTime() + 3600000 * 24 * nDays);
    if (nDays == null || nDays == 0) { nDays = 45; }

    var cookiesVal = escape(cookieValue);

    // ----------------------
    //set up cookie with objectr
    const cookies = [{
        'name': 'ac',
        'value': cookiesVal,
        'domain': brandUrl
    }];

    // ----------------------
    //set cookies on page
    const cookiesSet = await page.cookies(brandUrl);
    await page.setCookie(...cookies);
    console.log(JSON.stringify(cookiesSet));


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
        let cookiesSet = await page.cookies(url);
        await page.goto(url, { waitUntil: 'networkidle0' });
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

        var element = await page.$('.hero');
        // ----------------------
        // Take Hero screenshot since its not part of the parsys container
        var heroPath = dir + '/section_0.png';
        console.log(heroPath);
        await element.screenshot({ path: heroPath });

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


function b64_md5(s) {
    //return s.length;
    return binl2b64(core_md5(str2binl(s), s.length * chrsz));

};

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


function str2binl(str) {
    var bin = Array();
    var mask = (1 << chrsz) - 1;
    for (var i = 0; i < str.length * chrsz; i += chrsz)
        bin[i >> 5] |= (str.charCodeAt(i / chrsz) & mask) << (i % 32);
    return bin;
}


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


function safe_add(x, y) {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
}


function bit_rol(num, cnt) {
    return (num << cnt) | (num >>> (32 - cnt));
}

// ----------------------
//get brand from url passed on form

function getPath(url) {

    var temp = "." + url.match(/[^(?:http:\/\/|www\.|https:\/\/|www\-preview)\.|uat\.|preview\.|test\.)]([^\/]+)(com)/g);
    return temp;
}


// ----------------------
// This route triggers the above function for screenshotting when there is a get request and there are query paramets passed
router.get('/', function(req, res, next) {
    console.log('[LOG] Submitted URL: ' + req.query.url);
    // TODO: check if URL is valid and if not don't call the SShot function
    console.log('[LOG] Submitted PSW: ' + req.query.psw);
    SShot(res, next, req.query.url, req.query.psw);
});

module.exports = router;