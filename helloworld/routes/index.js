var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
    // Render html when home page is hit
    res.render('index', { title: 'Express' });
});

module.exports = router;