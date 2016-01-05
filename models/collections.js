'use strict';

var fs = require('fs');
var mongoose = require('../server').mongoose;
var slugify = require('../utils/slugify.js');
var async = require('async');
var utils = require('../utils/utils');
var crypto = require('crypto');

// Mongoose
var Schema = mongoose.Schema;
var collectionSchema = new Schema({
	created: { type: Date, default: Date.now },
	covers: [],
	description: String,
	items: [],
	owner: String,
	permalink: String,
	published: { type: Boolean, default: false },
	slugs: {
		title: String
	},
	template: { type: String, default: 'default' },
	title: String
}, { collection: 'collections' });

// Imagemagick
var im = require('simple-imagemagick');

// Database methods
var users = require('../models/users.js');

// Model
var Collection = mongoose.model('Collection', collectionSchema);

// Constructor
var collections = {};

collections = {

	getAll: function (user, result) {
		users.getOne({ 'id': user }, function (user) {
			Collection.find({}, function (err, collections) {
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

	// Find collection based on id or permalink
	getOne: function (query, result) {
		if (query.hasOwnProperty('id')) {
			query._id = query.id;
			delete query.id;
		}

		Collection.findOne(query, function (err, collection) {
			if (err || !collection) return result(false);

			// Turn items into ObjectId's
			var ObjectId = require('mongoskin').ObjectID;
			var items = collection.items.map(function (item) {
				return new ObjectId(item);
			});

			mongoose.connection.db.collection('songs', function (err, data) {
				data.find({ _id: { $in: items } }).toArray(function (err, items) {
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

		});
	},

	create: function (title, user, result) {
		var newCollection = new Collection({
			owner: user,
			permalink: slugify(title),
			slugs: {
				title: slugify(title)
			},
			title: title || 'New playlist'
		});

		async.waterfall([
			function (callback) {
				// Add new collection document to database
				newCollection.save(callback);
			},
			function (doc, status, callback) {
				// Add new collection reference to user document
				var newCollectionId = doc._id + '';
				users.getOne({ 'id': user }, function (user) {
					user.collections.push(newCollectionId);
					users.update(user._id, { 'collections': user.collections }, callback);
				});
			}
		], function (err) {
			if (err) throw err;

			if (typeof(result) === 'function') {
				return result(newCollection);
			}
		});
	},

	update: function (id, query, result) {
		if (!id) { return false; }

		Collection.findOneAndUpdate({ _id: id }, { '$set': query }, function (err, collection) {
			if (err) throw err;

			// Generate covers montage if the order changes for the first 4 songs
			if (collection.items.length > 4) {
				var items = collection.items.splice(0, 4);
				var isSame = items.every(function (element, index) {
					return element === query.items[index];
				});
				isSame || collections.createCoversMontage(id);
			}

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
				Collection.findOneAndRemove({ _id: id }, [], callback);
			},
			function (doc, sort, callback) {
				// Remove collection reference from user document
				users.getOne({ 'id': doc.owner }, function (user) {
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

		collections.getOne({ 'id': id }, function (result) {
			var path = './client/media/img/';
			var tempPath = './tmp/';
			var targetPath = './client/media/img/';
			var covers = [];

			if (result.songs.length < 4) {
				// Don't create montage if there's less than 4 covers in the collection
				return;
			}

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
						'./client/img/cloudlist-watermark.png', tempPath + generatedFilename,
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
