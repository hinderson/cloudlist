var webpack = require('webpack');

module.exports = {
	entry: {
		'admin': './assets/js/admin/admin.js',
		'default': './assets/js/templates/default.js',
		'best-songs-of-2014': './assets/js/templates/best-songs-of-2014.js',
		'best-songs-of-2015': './assets/js/templates/best-songs-of-2015.js',
		'best-songs-of-2016': './assets/js/templates/best-songs-of-2016.js'
	},
	output: {
		filename: '[name].js',
		path: './client/assets/js',
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
			chunks: [
				'default',
				'best-songs-of-2014',
				'best-songs-of-2015',
				'best-songs-of-2016'
			],
		})
	]
};
