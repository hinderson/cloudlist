'use strict';

// Hashid
var Hashids = require('hashids');
var secret = require('../config/private/secret.js');
var hashids = new Hashids(secret);

module.exports = {

	forEach: function (array, callback, scope) {
		for (var i = 0, len = array.length; i < len; i++) {
			callback.call(scope, i, array[i]);
		}
	},

	/*

	// Usage:
	// optionally change the scope as final parameter too, like ECMA5
	var myNodeList = document.querySelectorAll('li');
	forEach(myNodeList, function (index, value) {
		console.log(index, value); // passes index + value back!
	});

	*/

	/**
	 * Generates a random string containing numbers and letters
	 * @param  {number} length The length of the string
	 * @return {string} The generated string
	 */
	generateRandomString: function (length) {
		var text = '';
		var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

		for (var i = 0; i < length; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	},

	sortObj: function (obj, sortKey, sortOrder) {
		var sortedObjects = [];
		var len = obj.length;

		for (var i = 0; i < len; i++) {
			var id = obj[i][sortKey];
			obj[id] = obj[i];
		}

		for (var i = 0; i < len; i++) {
			var id = sortOrder[i];
			sortedObjects.push(obj[id]);
		}

		return sortedObjects;
	},

	generateHashmap: function (obj) {
		var generatedObjects = {};
		var len = obj.length;

		for (var i = 0; i < len; i++) {
			var id = obj[i].id;
			generatedObjects[id] = obj[i];
		}

		return generatedObjects;
	},

	findByKey: function (source, type, key) {
		return source.filter(function (obj) {
			return obj[type] === key;
		})[ 0 ];
	},

	structureSong: function (song) {
		var artist = Array.isArray(song.artist) && song.artist.length > 1 ? song.artist.slice(0, -1).join(', ') + ' & ' + song.artist[song.artist.length -1] : song.artist;
		var featuredartist = Array.isArray(song.featuredartist) && song.featuredartist.length > 1 ? song.featuredartist.slice(0, -1).join(', ') + ' & ' + song.featuredartist[song.featuredartist.length -1] : song.featuredartist;
		var combinedartist = artist + (featuredartist && featuredartist.length > 0 ? (' feat. ' + featuredartist) : '');
		var duration = Math.floor((song.audio.duration / (60 * 1000)) % 60) + ':' + (Math.floor((song.audio.duration / 1000) % 60) < 10 ? '0' : '') + Math.floor((song.audio.duration / 1000) % 60);

		song.artist = artist;
		song.featuredartist = featuredartist;
		song.combinedartist = combinedartist;
		song.duration = duration;

		return song;
	},

};