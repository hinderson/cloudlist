'use strict';

// General
var utils = require('../utils/utils');

// Hashid
var Hashids = require('hashids');
var secret = require('../config/private/secret.js');
var hashids = new Hashids(secret);

// Database methods
var collections = require('../methods/collections.js');
var songs = require('../methods/songs.js');

module.exports = function (router) {

	// Frontend: Single collection (with username)
	router.get('/:user/:collection', function (req, res, next) {
		collections.getOne(null, req.params.collection, function (result) {
			if (!result) return next();

			// Render template
			var template = result.collection.template;
			res.render('templates/' + template, {
				path: req.params.user + '/' + req.params.collection,
				collection: result.collection,
				songs: result.songs
			});
		});
	});

	// Frontend: Single song
	router.get('/:user/:collection/:permalink', function (req, res, next) {
		collections.getOne(null, req.params.collection, function (result) {
			if (!result) return next();

			// Render template
			var single = utils.findByKey(result.songs, 'permalink', req.params.permalink);
			var template = result.collection.template;
			res.render('templates/' + template, {
				path: req.params.user + '/' + req.params.collection,
				collection: result.collection,
				songs: result.songs,
				single: single
			});
		});
	});

};