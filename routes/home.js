'use strict';

// General
var utils = require('../utils/utils');

// Database methods
var collections = require('../models/collections.js');

module.exports = function (router) {

	// Frontend: Single collection (with username)
	router.get('/:user/:collection', function (req, res, next) {
		collections.getOne({ 'permalink': req.params.collection }, function (result) {
			if (!result) return next();

			res.render('templates/' + result.collection.template, {
				path: req.params.user + '/' + req.params.collection,
				collection: result.collection,
				songs: result.songs
			});
		});
	});

	// Frontend: Single song
	router.get('/:user/:collection/:permalink', function (req, res, next) {
		collections.getOne({ 'permalink': req.params.collection }, function (result) {
			if (!result) return next();

			var single = utils.findByKey(result.songs, 'permalink', req.params.permalink);
			if (!single) return next(); // Return 404 if song isn't found

			res.render('templates/' + result.collection.template, {
				path: req.params.user + '/' + req.params.collection,
				collection: result.collection,
				songs: result.songs,
				single: single
			});
		});
	});

};
