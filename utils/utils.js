'use strict';

module.exports = {

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

	sortObj: function (obj, sortOrder) {
		var sortedObjects = [];
		var len = obj.length;

		for (var i = 0; i < len; i++) {
			var id = obj[i]._id; // TEMP: Make it automatic
			obj[id] = obj[i];
		}

		for (var i = 0; i < len; i++) {
			var id = sortOrder[i];
			sortedObjects.push(obj[id]);
		}

		return sortedObjects;
	}



};