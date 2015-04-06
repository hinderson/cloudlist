'use strict';

var db = require('../server').db;
var slugify = require('../utils/slugify.js');
var async = require('async');
var ObjectId = require('mongoskin').ObjectID;

module.exports = {

	getAll: function (user, result) {
		var user = 1; // TEMP: User system

		db.collection('users').findOne({ _id: user }, function (err, user) {
			db.collection('collections').find().toArray(function (err, collections) {
				if (err) throw err;

				return result({
					collections: collections,
					sortorder: user.collections
				});
			});
		});
	},

	getOne: function (id, slug, result) {
		if (!id) { return false; }

		// Find collection based on id or slug
		var query = {};
		if (id) {
			query._id = ObjectId(id);
		} else {
			query.slugs.title = slug;
		}

		db.collection('collections').find(query).toArray(function (err, collection) {
			// Turn items into ObjectId's
			var items = collection[0].items;
			for (var i = 0, len = items.length; i < len; i++) {
				items[i] = ObjectId(items[i]);
			}

			// Match songs that are contained within the collection's items array
			db.collection('songs').find( { _id: { $in: items } } ).toArray(function (err, items) {
				return result({
					collection: collection[0],
					songs: items
				});
			});
		});
	},

	create: function (title, result) {
		var title = title || 'New playlist';

		var collection = {
			'created': new Date(),
			'covers': [],
			'description': '',
			'items': [],
			'owner': 1, // TEMP: Update once we have a user system
			'published': false,
			'slugs': {
				'title': slugify(title)
			},
			'title': title
		};

		async.waterfall([
			function (callback) {
				// Add new collection document to database
				db.collection('collections').insert(collection, callback);
			},
			function (doc, callback) {
				// Add new collection reference to user document
				// TEMP: Update this when there's a user system in place
				var collectionId = doc[0]._id + '';
				db.collection('users').update( { _id: 1 }, { $push: { 'collections': collectionId } }, callback);
			}
		], function (err) {
			if (err) throw err;

			return result(collection);
		});
	},

	update: function (id, meta, result) {
		if (!id) { return false; }

		var query = {};

		// Update collection title
		var title = meta.title;
		if (title) {
			query.title = title;
		}

		// Update items
		var items = meta.items;
		if (items) {
			query.items = items;
		}

		db.collection('collections').update( { _id: ObjectId(id) }, { '$set': query }, function (err) {
			if (err) throw err;

			return result(true);
		});
	},

	delete: function (id, result) {
		if (!id) { return false; }

		async.waterfall([
			function (callback) {
				// Remove collection document from database
				db.collection('collections').findAndRemove( { _id: ObjectId(id) }, [], callback);
			},
			function (doc, sort, callback) {
				// Remove collection reference from user document
				// TEMP: Update this when there's a user system in place (it should probably use ObjectId)
				var owner = doc.owner;
				db.collection('users').update( { _id: owner }, { $pull: { 'collections': id } }, callback);
			}
		], function (err) {
			if (err) throw err;

			return result(true);
		});
	}

};