var webpack = require('webpack');

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
	resolve: {
	    extensions: ['', '.js', '.json', '.coffee']
	},
	plugins: [
		new webpack.optimize.CommonsChunkPlugin('common.js')
	]
};
