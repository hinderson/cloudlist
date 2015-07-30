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
var collections = require('../../models/collections.js');
var songs = require('../../models/songs.js');
var users = require('../../models/users.js');

module.exports = function (router) {

	// GET Dashboard home page
	router.get('/:user', auth.connect(basic), function (req, res, next) {
		var name = req.params.user;
		users.getOne(null, name, function (user) {
			if (!user) return next();

			var userId = user._id;
			collections.getAll(userId, function (result) {
				res.render('dashboard/index', {
					user: user,
					collections: result.collections,
					sortorder: result.sortorder
				});
			});
		});
	});

	// GET Single collection page
	router.get('/:user/:id/edit', auth.connect(basic), function (req, res, next) {
		var id = hashids.decodeHex(req.params.id);
		collections.getOne(id, null, function (result) {
			if (!result) return next();

			res.render('dashboard/collection', {
				collection: result.collection,
				songs: result.songs
			});
		});
	});

	// GET single song page
	router.get('/:user/:id/edit', auth.connect(basic), function (req, res, next) {
		var id = hashids.decodeHex(req.params.id);
		songs.getOne(id, function (song) {
			if (!song) return next();

			res.render('dashboard/song', {
				song: song
			});
		});
	});


	// CREATE collection
	router.post('/create-collection/:user', function (req, res) {
		var user = hashids.decodeHex(req.params.user);
		collections.create(req.body.title, user, function (result) {
			res.redirect(req.headers.referer);
		});
	});

	// UPDATE collection
	router.post('/update-collection/:id', function (req, res) {
		var id = hashids.decodeHex(req.params.id);
		// Transform encoded id's
		if (req.body.items) {
			req.body.items = req.body.items.map(function (item) {
				return hashids.decodeHex(item);
			});
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