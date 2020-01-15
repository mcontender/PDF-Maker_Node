var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

// router.get('/snap', function(req, res, next) {
//     console.log('[LOG] Submitted URL: ' + req.query.url);
//     res.send(req.query.url);
// });

module.exports = router;