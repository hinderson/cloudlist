'use strict';

// Database methods
var collections = require('../methods/collections.js');
var songs = require('../methods/songs.js');

module.exports = function (router) {

	// Frontend: Single collection
	router.get('/:collection', function (req, res, next) {
		collections.getOne(null, req.params.collection, function (result) {
			if (!result) return next();

			var template = result.collection.template;
			res.render('templates/' + template, {
				path: req.params.collection,
				playlist: result.collection,
				songs: result.songs
			});
		});
	});

	// Frontend: Single song
	router.get('/:collection/:permalink', function (req, res, next) {
		collections.getOne(null, req.params.collection, function (result) {
			if (!result) return next();

			var template = result.collection.template;
			res.render('templates/' + template, {
				path: req.params.permalink,
				playlist: result.collection,
				songs: result.songs
			});
		});
	});

};