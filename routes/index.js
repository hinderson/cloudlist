'use strict';

var fs = require('fs');

var requireFiles = function (directory, app) {
	var validFileTypes = ['js'];

	fs.readdirSync(directory).forEach(function (fileName, index) {
		// Do not require recursively
		if (!fs.lstatSync(directory + '/' + fileName).isDirectory()) {
			// Skip this file
			if (fileName === 'index.js' && directory === __dirname) return;

			// Skip unknown filetypes
			if (validFileTypes.indexOf(fileName.split('.').pop()) === -1) return;

			// Require the file
			require(directory + '/' + fileName)(app);
		}
	})
};

module.exports = function (app) {
	// Require directories in order, to avoid collisions
	requireFiles(__dirname + '/api', app);
	requireFiles(__dirname + '/services', app);
	requireFiles(__dirname, app);
	requireFiles(__dirname + '/dashboard', app); // Since all of dashboard requires auth, this is put in last place
};