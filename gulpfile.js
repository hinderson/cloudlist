'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var path = require('path');
var sass = require('gulp-ruby-sass');
var prefix = require('gulp-autoprefixer');
var imagemin = require('gulp-imagemin');
var pngcrush = require('imagemin-pngcrush');
var cache = require('gulp-cache');
var newer = require('gulp-newer');
var merge = require('merge-stream');
var inject = require('gulp-inject');
var del = require('del');

var RevAll = require('gulp-rev-all');

var awspublish = require('gulp-awspublish');
var cloudfront = require('gulp-cloudfront');

var svgstore = require('gulp-svgstore');
var svgmin = require('gulp-svgmin');

var webpack = require('webpack');

// Webpack task for use in deployment
gulp.task('webpack:prod', function (callback) {

	// Modify/overwrite some default webpack config options
	var config = require('./webpack.config.js');
	var prodConfig = Object.create(config);

	prodConfig.output = {
		filename: '[name].js',
		path: path.join(__dirname, './tmp/', 'js'),
		publicPath: '/js/'
	};

	prodConfig.plugins = prodConfig.plugins.concat(
		new webpack.optimize.DedupePlugin(),
		new webpack.optimize.UglifyJsPlugin(),
		new webpack.optimize.OccurenceOrderPlugin(),
		new webpack.DefinePlugin({
			'process.env': {
				'NODE_ENV': '"production"'
			}
		})
	);

	webpack(prodConfig, function (err, stats) {
		if (err) throw new gutil.PluginError('webpack', err);
		gutil.log('[webpack]', stats.toString({
			colors: true
		}));

		var revAll = new RevAll({
			transformFilename: function (file, hash) {
				var ext = path.extname(file.path);
				return path.basename(file.path, ext) + '-' + hash.substr(0, 8) + ext;
			},
			fileNameManifest: 'rev-manifest-js.json'
		});

		// Rev the files and create a manifest with references to them
		gulp.src('./tmp/js/*')
			.pipe(revAll.revision())
			.pipe(gulp.dest('./dist/js/'))
			.pipe(revAll.manifestFile())
			.pipe(gulp.dest('./client/'));

		callback();
	});
});

// Sass for development
gulp.task('sass:dev', function ( ) {
	return sass('./client/sass', { sourcemap: true })
		.on('error', function (err) {
			console.error('Error!', err.message);
		})
		.pipe(prefix('last 2 versions', '> 1%'))
		.pipe(gulp.dest('./client/css/'));
});

// Sass for production
gulp.task('sass:prod', function ( ) {
	var revAll = new RevAll({
		transformFilename: function (file, hash) {
			var ext = path.extname(file.path);
			return path.basename(file.path, ext) + '-' + hash.substr(0, 8) + ext;
		},
		fileNameManifest: 'rev-manifest-css.json'
	});

	return sass('./client/sass', { sourcemap: false, style: 'compressed' })
		.on('error', function (err) {
			console.error('Error!', err.message);
		})
		.pipe(prefix('last 2 versions', '> 1%'))
		.pipe(revAll.revision())
		.pipe(gulp.dest('./dist/css/'))
		.pipe(revAll.manifestFile())
		.pipe(gulp.dest('./client/'));
});

// Watcher for Sass
var watcher = gulp.watch('./client/sass/**/*.scss', ['sass:dev']);
watcher.on('change', function (event) {
	console.log('File ' + event.path + ' was ' + event.type + ', running tasks...');
});

// SVG Store
gulp.task('svgstore', function ( ) {
	function fileContents (filePath, file) {
		return file.contents.toString('utf8');
	}

	var svgs = gulp.src('./client/img/sprite/*.svg')
		.pipe(svgmin())
		.pipe(svgstore({
			fileName: 'asset-sprite.svg',
			inlineSvg: true,
			transformSvg: function (svg, cb) {
				svg.attr({ style: 'display:none' });
				cb(null);
			}
		}));

	return gulp.src('./views/layout.jade')
		.pipe(inject(svgs, { transform: fileContents } ))
		.pipe(gulp.dest('./views/'));
});

// Compress images assets
gulp.task('images-assets', function ( ) {
	return gulp.src('./client/img/*.{gif,jpg,png,svg}')
		.pipe(newer('./client/img/'))
		.pipe(cache(imagemin({
			progressive: true,
			use: [pngcrush()]
		})));
});

// Publish to Amazon S3
gulp.task('publish', function ( ) {
	var headers = {'Cache-Control': 'max-age=315360000, no-transform, public'};
	var aws = require('./config/private/aws.json');
	var publisher = awspublish.create(aws);

	return merge([
		// Regular content: mainly media
		gulp.src(['./dist/**/*', '!./dist/**/*.{css,js,woff}']),
		// Gzipped content: mainly assets
		gulp.src('./dist/**/*.{css,js,woff}')
			.pipe(awspublish.gzip())
	])
	.pipe(publisher.publish(headers))
	.pipe(publisher.cache())
	.pipe(awspublish.reporter())
	.pipe(cloudfront(aws));
});

gulp.task('publish-uploads', function ( ) {
	var headers = {'Cache-Control': 'max-age=315360000, no-transform, public'};
	var aws = require('./config/private/aws.json');
	var publisher = awspublish.create(aws);

	return gulp.src('./client/media/**/*')
		.pipe(publisher.publish(headers))
		.pipe(publisher.cache())
		.pipe(awspublish.reporter())
		.pipe(cloudfront(aws));
});

gulp.task('clean-tmp', function (callback) {
	del('./tmp/**/*', callback);
});

gulp.task('default', function ( ) {
	gulp.start('sass:dev');
});

// Run deploy task for uploads folder
gulp.task('deploy-uploads', function ( ) {
	gulp.start('publish-uploads');
});

// Run deploy task for assets
gulp.task('deploy', function ( ) {
	gulp.start('webpack:prod', 'sass:prod', 'images-assets', 'clean-tmp', 'publish');
});
