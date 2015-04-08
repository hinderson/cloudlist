var express = require('express');
var favicon = require('serve-favicon');
var fs = require('fs');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multer = require('multer');
var compression = require('compression');
var CDN = require('express-simple-cdn');
var forceSSL = require('express-force-ssl');

var mongo = require('mongoskin');
var db = mongo.db('mongodb://localhost:27017/cloudlist', { native_parser:true });
exports.db = db;

var app = express();

// Favicon
app.use(favicon('./public/favicon.ico'));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

var env = process.env.NODE_ENV;
if ('production' === env) {
	console.log('Server started and listening on port 443 in production mode');

	app.use(forceSSL);
	app.locals.CDN = function(path) { return CDN(path, 'https://static.cloudlist.io') };
	app.locals.env = 'production';
} else {
	console.log('Server started and listening on port 3000 in development mode');

	app.locals.pretty = true;
	app.locals.env = 'development';
	app.locals.CDN = function(path) { return CDN(path) };

	// Change error handling
	app.use(function (err, req, res, next) {
		res.status(err.status || 500);
		res.render('error', {
			message: err.message,
			error: err
		});
	});
}

// Expose ID encryption util globally
var Hashids = require('hashids');
var secret = require('./config/private/secret.js');
var hashids = new Hashids(secret);
app.locals.hashids = hashids;

// Send globals
app.locals.rootTitle = 'Cloudlist.io';
app.locals.rootHost = 'production' === env ? 'https:://www.cloudlist.io' : 'http://localhost:3000'

app.use(logger('dev'));
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(multer({ dest: './tmp/' }));
app.use(cookieParser());

if ('production' === env) {
	app.use(function (req, res, next) {
		if (!req.secure) {
			return res.redirect(['https://', req.get('Host'), req.url].join(''));
		}
		next();
	});
} else {
	app.use(express.static(path.join(__dirname, 'public')));
}

// Make our db accessible to our router
app.use(function (req, res, next) {
	req.db = db;
	next();
});

// Require all routes at the same time
require('./routes')(app);

// Handle 404
app.use(function (req, res) {
	res.status(400);
	res.render('404.jade', { title: '404: Page Not Found' });
});

// Handle 500
/*
app.use(function(error, req, res, next) {
	res.status(500);
	res.render('500.jade', {title:'500: Internal Server Error', error: error});
});
*/

module.exports = app;