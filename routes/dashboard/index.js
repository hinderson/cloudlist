'use strict';

// Auth stuff
var auth = require('http-auth');
var basic = auth.basic({
	realm: 'Cloudlist',
	file: './config/private/users.htpasswd'
});

// Hashid
var Hashids = require('hashids');
var secret = require('../../config/private/secret.js');
var hashids = new Hashids(secret);

// Database methods
var collections = require('../../methods/collections.js');
var songs = require('../../methods/songs.js');
var users = require('../../methods/users.js');

module.exports = function (router) {

	// GET Dashboard home page
	router.get('/:user', auth.connect(basic), function (req, res, next) {
		var name = req.params.user;
		users.getOne(null, name, function (user) {
			if (!user) return next();

			var userId = user._id;
			collections.getAll(userId, function (result) {
				res.render('dashboard/index', {
					collections: result.collections,
					sortorder: result.sortorder
				});
			});
		});
	});

	// GET Single collection page
	router.get('/:user/:id/edit', auth.connect(basic), function (req, res, next) {
		// TODO: Fix so that it's slug based
		var id = hashids.decodeHex(req.params.id);
		collections.getOne(id, null, function (result) {
			if (!result) return next();

			res.render('dashboard/collection', {
				collection: result.collection,
				songs: result.songs
			});
		});
	});


	// CREATE collection
	router.post('/create-collection', function (req, res) {
		collections.create(req.body.title, function (result) {
			res.redirect(req.headers.referer);
		});
	});

	// UPDATE collection
	router.post('/update-collection/:id', function (req, res) {
		var id = hashids.decodeHex(req.params.id);
		var items = req.body.items;
		if (items) {
			for (var i = 0, len = items.length; i < len; i++) {
				req.body.items[i] = hashids.decodeHex(items[i]);
			}
		}
		collections.update(id, req.body, function (result) {
			if (result) {
				res.redirect(req.headers.referer);
			}
		});
	});

	// DELETE collection
	router.post('/delete-collection/:id', function (req, res) {
		var id = hashids.decodeHex(req.params.id);
		collections.delete(id, function ( ) {
			res.redirect(req.headers.referer);
		});
	});


	// CREATE song
	router.post('/create-song/:collectionId', function (req, res) {
		var collectionId = hashids.decodeHex(req.params.collectionId);
		songs.create(collectionId, req.body, req.files, function (result) {
			if (result) {
				res.redirect(req.headers.referer);
			}
		});
	});

	// UPDATE song
	router.post('/update-song/:id', function (req, res) {
		var id = hashids.decodeHex(req.params.id);
		songs.update(id, req.body, function (result) {
			if (result) {
				res.redirect(req.headers.referer);
			}
		});
	});

	// DELETE song
	router.post('/delete-song/:id', function (req, res) {
		var id = hashids.decodeHex(req.params.id);
		songs.delete(id, function (result) {
			if (result) {
				res.redirect(req.headers.referer);
			}
		});
	});

};