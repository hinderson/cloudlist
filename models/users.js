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

	// Find user based on id or username
	getOne: function (query, callback) {
		if (query.hasOwnProperty('id')) {
			query._id = new ObjectId(query.id);
			delete query.id;
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

		db.collection('users').update( { _id: new ObjectId(id) }, { '$set': query }, function (err) {
			if (err) throw err;

			if (typeof(callback) === 'function') {
				return callback();
			}
		});
	},

	delete: function (id, result) {

	}

};
