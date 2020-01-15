var express = require('express');
var router = express.Router();

/* GET wiki listing. */
router.get('/', function(req, res, next) {
    res.render('wiki', { title: 'Wiki' });
});

module.exports = router;