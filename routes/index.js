'use strict';

var fs = require('fs');

var requireFiles = function (directory, app) {
	var validFileTypes = ['js'];

	fs.readdirSync(directory).forEach(function (fileName, index) {
		// Recurse if directory
		if (fs.lstatSync(directory + '/' + fileName).isDirectory()) {
			requireFiles(directory + '/' + fileName, app);
		} else {
			// Skip this file
			if (fileName === 'index.js' && directory === __dirname) return;

			// Skip unknown filetypes
			if (validFileTypes.indexOf(fileName.split('.').pop()) === -1) return;

			// Skip dashboard so we can require it manually
			if (directory.substr(directory.lastIndexOf('/') + 1) === 'dashboard') return;

			// Require the file.
			require(directory + '/' + fileName)(app);
		}
	})
}

module.exports = function (app) {
	requireFiles(__dirname, app);
	require(__dirname + '/dashboard/index.js')(app); // Require dashboard manually
}