'use strict';

var fs = require('fs');
var db = require('../server').db;
var slugify = require('../utils/slugify.js');
var async = require('async');
var ObjectId = require('mongoskin').ObjectID;
var utils = require('../utils/utils');
var crypto = require('crypto');

// Imagemagick
var im = require('simple-imagemagick');

// Database methods
var users = require('../models/users.js');

// Constructor
var collections = {};

collections = {

	getAll: function (user, result) {
		users.getOne(user, null, function (user) {
			db.collection('collections').find( ).toArray(function (err, collections) {
				if (err) throw err;

				if (typeof(result) === 'function') {
					return result({
						collections: collections,
						sortorder: user.collections
					});
				}
			});
		});
	},

	getOne: function (id, slug, result) {
		if (id === null && slug === null) { return false; }

		// Find collection based on id or slug
		var query = {};
		if (id) {
			query._id = new ObjectId(id);
		} else {
			query.permalink = slug;
		}

		db.collection('collections').find(query).toArray(function (err, collection) {
			if (err || collection === undefined || collection.length === 0) return result(false);

			// Turn items into ObjectId's
			collection = collection[0];
			var items = collection.items.map(function (item) {
				return new ObjectId(item);
			});

			// Match songs that are contained within the collection's items array
			db.collection('songs').find( { _id: { $in: items } } ).toArray(function (err, items) {
				if (err) throw err;

				var hashmap = utils.makeHashmap(items);
				var sortedSongs = utils.sortHashmap(hashmap, collection.items);

				if (typeof(result) === 'function') {
					return result({
						collection: collection,
						songs: sortedSongs
					});
				}
			});
		});
	},

	create: function (title, user, result) {
		title = title || 'New playlist';

		var collection = {
			'created': new Date(),
			'covers': [],
			'description': '',
			'items': [],
			'owner': user,
			'permalink': slugify(title),
			'published': false,
			'slugs': {
				'title': slugify(title)
			},
			'template': 'default',
			'title': title
		};

		async.waterfall([
			function (callback) {
				// Add new collection document to database
				db.collection('collections').insert(collection, callback);
			},
			function (doc, callback) {
				// Add new collection reference to user document
				var newCollectionId = doc[0]._id + '';
				users.getOne(user, null, function (user) {
					user.collections.push(newCollectionId);
					users.update(user._id, { 'collections': user.collections }, callback);
				});
			}
		], function (err) {
			if (err) throw err;

			if (typeof(result) === 'function') {
				return result(collection);
			}
		});
	},

	update: function (id, query, result) {
		if (!id) { return false; }

		// Generate covers montage if the order changes for the first 4 songs
		if (query.hasOwnProperty('items')) {
			collections.getOne(id, null, function (data) {
				// Look through the first 4 items in the old and new array to detect changes
				var items = data.collection.items.splice(0, 4);
				var isSame = items.every(function (element, index) {
					return element === query.items[index];
				});
				isSame || collections.createCoversMontage(id);
			});
		}

		db.collection('collections').update( { _id: new ObjectId(id) }, { '$set': query }, function (err) {
			if (err) throw err;

			if (typeof(result) === 'function') {
				return result(true);
			}
		});
	},

	delete: function (id, result) {
		if (!id) { return false; }

		async.waterfall([
			function (callback) {
				// Remove collection document from database
				db.collection('collections').findAndRemove( { _id: new ObjectId(id) }, [], callback);
			},
			function (doc, sort, callback) {
				// Remove collection reference from user document
				users.getOne(doc.owner, null, function (user) {
					var collections = user.collections.filter(function (collection) {
						return collection !== id;
					});

					users.update(user._id, { 'collections': collections }, callback);
				});
			}
		], function (err) {
			if (err) throw err;

			if (typeof(result) === 'function') {
				return result(true);
			}
		});
	},

	createCoversMontage: function (id, result) {
		if (!id) { return false; }

		collections.getOne(id, null, function (result) {
			var path = './client/media/img/';
			var tempPath = './tmp/';
			var targetPath = './client/media/img/';
			var covers = [];

			var slicedArray = result.songs.slice(0, 4);
			async.eachSeries(slicedArray, function (song, callback) {
				var cover = song.covers[0].filename;
				var index = result.songs.indexOf(song);

				// Create thumbnails of the first 4 images
				im.convert([
					path + cover,
					'-thumbnail', '250x250^',
					'-gravity', 'center',
					'-extent', '250x250',
					tempPath + 'temp-crop-img-' + index + '.jpg'
				], function (err, stdout) {
					if (err) return console.log(err);

					covers.push('temp-crop-img-' + index + '.jpg');
					callback();
				});
			}, function (err) {
				if (err) return console.log(err);

				var generatedFilename = crypto.randomBytes(12).toString('hex') + '.jpg';

				// Create a montage/grid of all 4 temporarily created thumbnails
				im.montage([
					tempPath + covers[0],
					tempPath + covers[1],
					tempPath + covers[2],
					tempPath + covers[3],
					'-tile', '2x2',
					'-geometry', '+0+0',
					tempPath + generatedFilename
				], function (err, stdout) {
					if (err) return console.log(err);

					// Delete temporarily created thumbnails
					utils.forEach(covers, function (index, file) {
						fs.unlink('./tmp/' + file, function (err) {
							if (err) throw err;

							console.log('Deleting ' + file);
						});
					});

					// Add watermark
					im.composite([
						'-gravity', 'center',
						'./client/build/img/cloudlist-watermark.png', tempPath + generatedFilename,
						targetPath + generatedFilename
					], function (err) {
						if (err) return console.log(err);

						console.log('Montage created', generatedFilename);

						var montage = {
							format: 'JPEG',
							filename: generatedFilename,
							width: 500,
							height: 500
						};

						collections.update(id, { 'thumbnails.montage':  montage });

						// Delete temporarily created montage without watermark
						fs.unlink(tempPath + generatedFilename, function (err) {
							if (err) throw err;

							console.log('Deleting temp ' + generatedFilename);
						});
					});
				});
			});
		});
	},

};

module.exports = collections;
