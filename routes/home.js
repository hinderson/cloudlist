'use strict';

// Database methods
var collections = require('../methods/collections.js');
var songs = require('../methods/songs.js');

module.exports = function (router) {

	// Frontend: Single collection (with username)
	router.get('/:user/:collection', function (req, res, next) {
		collections.getOne(null, req.params.collection, function (result) {
			if (!result) return next();

			var template = result.collection.template;
			res.render('templates/' + template, {
				path: req.params.collection,
				collection: result.collection,
				songs: result.songs
			});
		});
	});

	// Frontend: Single song
	router.get('/:user/:collection/:permalink', function (req, res, next) {
		collections.getOne(null, req.params.collection, function (result) {
			if (!result) return next();

			var template = result.collection.template;
			res.render('templates/' + template, {
				path: req.params.permalink,
				collection: result.collection,
				songs: result.songs
			});
		});
	});

};