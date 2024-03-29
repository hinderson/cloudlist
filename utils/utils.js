'use strict';

var utils = {};

utils = {
	forEach: function (array, callback, scope) {
		for (var i = 0, len = array.length; i < len; i++) {
			callback.call(scope, i, array[i]);
		}
	},

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

	makeHashmap: function (obj) {
		return obj.reduce(function (acc, item) {
			var sortKey = item.id || item._id;
			acc[sortKey] = item;
			return acc;
		}, {});
	},

	sortHashmap: function (hashmap, sortArray) {
		return sortArray.map(function (id) {
			return hashmap[id];
		});
	},

	findByKey: function (source, type, key) {
		return source.filter(function (obj) {
			return obj[type] === key;
		})[0];
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

	deepCopy: function (o) {
		var copy = o,k;

    	if (o && typeof o === 'object') {
        	copy = Object.prototype.toString.call(o) === '[object Array]' ? [] : {};
	    	for (k in o) {
	        	copy[k] = utils.deepCopy(o[k]);
	        }
	    }

	    return copy;
	}
};

module.exports = utils;
