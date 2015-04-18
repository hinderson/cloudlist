'use strict';

var db = require('../server').db;
var ObjectId = require('mongoskin').ObjectID;

module.exports = {

	getAll: function (result) {
		db.collection('users').find( ).toArray(function (err, users) {
			if (err) throw err;

			return result(users);
		});
	},

	getOne: function (id, name, result) {

		// Find user based on id or name
		var query = {};
		if (id) {
			query._id = ObjectId(id);
		} else {
			query.username = name;
		}

		db.collection('users').findOne(query, function (err, user) {
			if (err) throw err;

			return result(user);
		});
	},

	create: function (title, result) {

	},

	update: function (id, meta, result) {

	},

	delete: function (id, result) {

	}

};