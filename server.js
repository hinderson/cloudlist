var express = require('express');
var favicon = require('serve-favicon');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multer = require('multer');
var compression = require('compression');
var forceDomain = require('forcedomain');
var utils = require('./utils/utils');

// Config
var config = require('config');

// MongoDB
var mongo = require('mongoskin');
var dbConfig = config.get('db');
var db = mongo.db(dbConfig.host + ':' + dbConfig.port + '/' + dbConfig.name, { native_parser:true });
exports.db = db;

var app = express();
var env = process.env.NODE_ENV;

// Favicon
app.use(favicon(__dirname + '/client/favicon.ico'));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Send globals
app.locals.config = config;

if (env === 'production') {
	console.log('Server started and listening on port 443 in production mode');

	// Force browser to www
	app.use(forceDomain({
		hostname: config.host.name,
		protocol: config.host.protocol
	}));

	var assets = {
		'styles': require('./client/rev-manifest-css.json'),
		'scripts': require('./client/rev-manifest-js.json')
	};
	app.locals.assets = assets;
	app.locals.prod = true;
} else {
	console.log('Server started and listening on port 3000 in development mode');

	app.locals.pretty = true;

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

// Expose structure song util globally
app.locals.structureSong = utils.structureSong;

app.use(logger('dev'));
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(multer({ dest: './tmp/' }));
app.use(cookieParser());

if (env === 'production') {
	// Serve Let's Encrypt acme challenge
	app.use(express.static(path.join(__dirname, 'ssl')));

	app.use(function (req, res, next) {
		if (!req.secure) {
			return res.redirect(['https://', req.get('Host'), req.url].join(''));
		}
		next();
	});
} else {
	app.use(express.static(path.join(__dirname, 'client')));
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
	res.render('404.pug', { title: '404: Page Not Found' });
});

// Handle 500
if (env === 'production') {
	app.use(function (err, req, res, next) {
		res.status(500);
	});
}

module.exports = app;
