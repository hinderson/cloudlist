var webpack = require('webpack');
var path = require("path");

module.exports = {
	entry: {
		default: './client/dev/js/templates/default.js',
		'best-songs-of-2014': './client/dev/js/templates/best-songs-of-2014.js'
	},
	output: {
		filename: '[name].js',
		path: path.join(__dirname, './client/build', 'js'),
		publicPath: '/js/'
	},
	module: {
		loaders: [
			{ test: /\.css$/, loader: 'style!css' }
		]
	},
	plugins: [
		new webpack.optimize.CommonsChunkPlugin('common.js')
	]
};