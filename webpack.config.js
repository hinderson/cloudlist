var webpack = require('webpack');

module.exports = {
	entry: {
		'admin': './client/js/admin/admin.js',
		'default': './client/js/templates/default.js',
		'best-songs-of-2014': './client/js/templates/best-songs-of-2014.js',
		'best-songs-of-2015': './client/js/templates/best-songs-of-2015.js'
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
		new webpack.optimize.CommonsChunkPlugin({
			name: 'admin-common',
			filename: 'admin-common.js',
			chunks: ['admin'],
		}),
		new webpack.optimize.CommonsChunkPlugin({
			name: 'common',
			filename: 'common.js',
			chunks: ['default', 'best-songs-of-2014', 'best-songs-of-2015'],
		})
	]
};
