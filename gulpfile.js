'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var sourcemaps = require('gulp-sourcemaps');
var webpack = require('webpack');
var webpackConfig = require('./webpack.config.js');

var postcss = require('gulp-postcss');
var postCssProcessors = [
	require('postcss-import')({ from: './assets/css/main.css' }),
	require('postcss-custom-media'),
	require('postcss-custom-properties'),
	require('postcss-nested'),
	require('postcss-calc'),
	require('autoprefixer')({ browsers: ['last 2 versions', '> 2%'] }),
	require('cssnano')({
	    discardComments: {
	        removeAll: true
	    }
	})
];

// Post CSS task for use in development
gulp.task('css:dev', function ( ) {
	return gulp.src('./assets/css/templates/**/*.css')
		.pipe(sourcemaps.init())
		.pipe(postcss(postCssProcessors))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('./client/assets/css'));
});

// Webpack task for use in development
gulp.task('webpack:dev', function (callback) {
	// Modify/overwrite some default webpack config options
	var devConfig = Object.create(webpackConfig);

	devConfig.devtool = 'sourcemap';
	devConfig.debug = true;

	webpack(devConfig, function (err, stats) {
		if (err) { throw new gutil.PluginError('webpack:dev', err); }

		gutil.log('[webpack:dev]', stats.toString({
			colors: true
		}));

		callback();
	});
});

// Default watch task for use in development
gulp.task('watch', function ( ) {
	gulp.watch('./assets/css/**/*.css', ['css:dev']);
	gulp.watch('./assets/js/**/*.js', ['webpack:dev']);
});

// Default dev task
gulp.task('default', function ( ) {
	gulp.start('css:dev');
});
