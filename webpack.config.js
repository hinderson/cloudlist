var webpack = require('webpack');
var path = require("path");

module.exports = {
	entry: {
		'default': './client/js/templates/default.js',
		'best-songs-of-2014': './client/js/templates/best-songs-of-2014.js'
	},
	output: {
		filename: '[name].js',
		path: './client/js/build',
		publicPath: '/js/'
	},
	plugins: [
		new webpack.optimize.CommonsChunkPlugin('common.js')
	]
};