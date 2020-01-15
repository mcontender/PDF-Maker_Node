var express = require('express');
var logger = require('morgan');
var square = require('../../modules/square'); // Here we require() the name of the file without the (optional) .js file extension
var wiki = require('../../modules/wiki.js');
var app = express();

// An example middleware function
var a_middleware_function = function(req, res, next) {
    // ... perform some operations
    next(); // Call next() so Express will call the next middleware function in the chain.
};

/* --------------------
Set Section
-------------------- */
// Set directory to contain the templates ('views')
app.set('views', path.join(__dirname, 'views'));
// Set view engine to use, in this case 'some_template_engine_name'
app.set('view engine', 'example');

/* --------------------
Use Section
-------------------- */
app.use('/wiki', wiki);
app.use(logger('dev'));
app.use('/media', express.static('media'));
app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

/* --------------------
Get Section
-------------------- */
app.get('/', function(req, res) {
    res.send('Hello World! From Express!');
    console.log('The area of a square with a width of 4 is ' + square.area(4));
});

/* --------------------
Listen Section
-------------------- */
app.listen(3000, function() {
    console.log('Example app listening on port 3000!');
});

/* --------------------
All Section
-------------------- */
app.all('/secret', function(req, res, next) {
    console.log('Accessing the secret section ...');
    next(); // pass control to the next handler
});