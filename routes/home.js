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
		var db = req.db;

		// TEMP: Trying out url (maybe put it in a module?)
		var url = parseUrl.parse(req.headers.referer).pathname.split('/').filter(function(e){return e});
		var collectionSlug = url[0];

		var env = process.env.NODE_ENV;
		if ('production' === env) {
			var oneYear = 31556952000;
			res.header('Cache-Control', 'max-age=' + oneYear);
		}

		// Find the correct collection based on slug
		db.collection('collections').find( { 'slugs.title': collectionSlug } ).toArray(function (err, collection) {
			songs.getAll(collection[0]._id, function (result) {
				res.json({
					'order': result.order,
					'items': result.items
				});
			});
		});
	});

	// Frontend: Single collection
	router.get('/:collection', function (req, res) {
		collections.getOne(null, req.params.collection, function (result) {
			res.render('index', {
				title: 'Cloudlist.io',
				path: req.params.collection,
				playlist: result.collection,
				songs: result.songs
			});
		});
	});

	// Frontend: Single song
	router.get('/:collection/:permalink', function (req, res) {
		collections.getOne(null, req.params.collection, function (result) {
			res.render('index', {
				title: 'Cloudlist.io',
				path: req.params.permalink,
				playlist: result.collection,
				songs: result.songs
			});
		});
	});

}