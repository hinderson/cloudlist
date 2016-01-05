'use strict';

// General
var mongoose = require('../server').mongoose;

// Mongoose
var Schema = mongoose.Schema;
var userSchema = new Schema({
	created: { type: Date, default: Date.now },
	avatar: {
		small: String,
		medium: String,
		large: String
	},
	collections: [],
	username: String,
	name: {
		first: String,
		last: String
	}
}, { collection: 'users' });

// Model
var User = mongoose.model('User', userSchema);

module.exports = {

	getAll: function (callback) {
		User.find({}, function (err, users) {
			if (err) throw err;

			if (typeof(callback) === 'function') {
				return callback(users);
			}
		});
	},

	// Find user based on id or username
	getOne: function (query, callback) {
		if (query.hasOwnProperty('id')) {
			query._id = query.id;
			delete query.id;
		}

		User.where(query).findOne(function (err, user) {
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

		User.update({_id: id}, { '$set': query }, function (err) {
			if (err) throw err;

			if (typeof(callback) === 'function') {
				return callback();
			}
		});
	},

	delete: function (id, result) {

	}

};
