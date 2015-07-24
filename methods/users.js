'use strict';

var db = require('../server').db;
var ObjectId = require('mongoskin').ObjectID;

module.exports = {

	getAll: function (callback) {
		db.collection('users').find( ).toArray(function (err, users) {
			if (err) throw err;

			if (typeof(callback) === 'function') {
				return callback(users);
			}
		});
	},

	getOne: function (id, name, callback) {

		// Find user based on id or name
		var query = {};
		if (id) {
			query._id = ObjectId(id);
		} else {
			query.username = name;
		}

		db.collection('users').findOne(query, function (err, user) {
			if (err) throw err;

			if (typeof(callback) === 'function') {
				return callback(user);
			}
		});
	},

	create: function (title, result) {

	},

	update: function (id, query, callback) {
		if (!id) { return false; }

		db.collection('users').update( { _id: ObjectId(id) }, { '$set': query }, function (err) {
			if (err) throw err;

			if (typeof(callback) === 'function') {
				return callback();
			}
		});
	},

	delete: function (id, result) {

	}

};