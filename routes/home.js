'use strict';

var utils = require('../utils/utils');

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