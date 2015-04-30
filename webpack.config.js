var webpack = require('webpack');
var path = require("path");
var SaveAssetsJson = require('assets-webpack-plugin');
var commonsPlugin = new webpack.optimize.CommonsChunkPlugin('common.js');

module.exports = {
	entry: {
		default: './assets/js/templates/default.js',
		'best-songs-of-2014': './assets/js/templates/best-songs-of-2014.js'
	},
	output: {
		filename: '[name].js',
		path: path.join(__dirname, 'public/assets', 'js'),
		publicPath: '/assets/js/'
	},
	module: {
		loaders: [
			{ test: /\.css$/, loader: 'style!css' }
		]
	},
	plugins: [commonsPlugin, new SaveAssetsJson()]
};

// For later: use this for filename [name]-bundle-[hash].js when in production