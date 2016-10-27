'use strict';

var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

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
		.pipe(postcss(postCssProcessors, {syntax: require('postcss-scss')}))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('./client/assets/css'));
});

// Default watch task for use in development
gulp.task('watch', function ( ) {
	gulp.watch('./assets/css/templates/**/*.css', ['css:dev']);
});

// Default dev task
gulp.task('default', function ( ) {
	gulp.start('css:dev');
});
