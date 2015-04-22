'use strict';

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

	findByKey: function (source, type, key) {
		return source.filter(function (obj) {
			return obj[type] === key;
		})[ 0 ];
	},

};