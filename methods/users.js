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

	getOne: function (id, result) {
		db.collection('users').findOne({ _id: id }, function (err, user) {
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