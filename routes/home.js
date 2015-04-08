'use strict';

// General
var ObjectId = require('mongoskin').ObjectID;
var parseUrl = require('url');

// Hashid
var Hashids = require('hashids');
var secret = require('../config/private/secret.js');
var hashids = new Hashids(secret);

// Database methods
var collections = require('../methods/collections.js');
var songs = require('../methods/songs.js');

module.exports = function (router) {

	// Return all songs in JSON format
	router.get('/song-collection', function (req, res) {
		// TEMP: Trying out url module (maybe put it in a module?)
		var collection = parseUrl.parse(req.headers.referer).pathname.split('/').filter(function(e){return e})[0];

		collections.getOne(null, collection, function (result) {
			if ('production' === process.env.NODE_ENV) {
				res.header('Cache-Control', 'max-age=' + 31556952000); // One year
			}

			res.json({
				order: result.collection.items,
				items: result.songs
			});
		});
	});

	// Frontend: Single collection
	router.get('/:collection', function (req, res) {
		collections.getOne(null, req.params.collection, function (result) {
			var template = result.collection.template;
			res.render('templates/' + template, {
				path: req.params.collection,
				playlist: result.collection,
				songs: result.songs
			});
		});
	});

	// Frontend: Single song
	router.get('/:collection/:permalink', function (req, res) {
		collections.getOne(null, req.params.collection, function (result) {
			var template = result.collection.template;
			res.render('templates/' + template, {
				path: req.params.permalink,
				playlist: result.collection,
				songs: result.songs
			});
		});
	});

}