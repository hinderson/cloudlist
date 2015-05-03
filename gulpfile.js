var gulp = require('gulp');
var path = require('path');
var gutil = require('gulp-util');
var sass = require('gulp-ruby-sass');
var prefix = require('gulp-autoprefixer');
var imagemin = require('gulp-imagemin');
var pngcrush = require('imagemin-pngcrush');
var cache = require('gulp-cache');
var notify = require('gulp-notify');
var rename = require('gulp-rename');
var newer = require('gulp-newer');
var merge = require('merge-stream');
var inject = require('gulp-inject');

var RevAll = require('gulp-rev-all');

var awspublish = require('gulp-awspublish');
var cloudfront = require('gulp-cloudfront');
var replace = require('gulp-replace');

var webpack = require('webpack');
var SaveAssetsJson = require('assets-webpack-plugin');

var svgstore = require('gulp-svgstore');
var svgmin = require('gulp-svgmin');

// Webpack task for use in deployment
gulp.task('webpack:prod', function (callback) {

	// Modify/overwrite some default webpack config options
	var config = require('./webpack.config.js');
	var prodConfig = Object.create(config);

	prodConfig.output = {
		filename: '[name].js',
		path: path.join(__dirname, 'client/dist/assets', 'js'),
		publicPath: '/assets/js/'
	};

	prodConfig.plugins = prodConfig.plugins.concat(
		new webpack.DefinePlugin({
			'process.env': {
				// This has effect on the react lib size
				'NODE_ENV': JSON.stringify('production')
			}
		}),
		new webpack.optimize.DedupePlugin(),
		new webpack.optimize.UglifyJsPlugin(),
		new webpack.optimize.CommonsChunkPlugin('common.js'),
		new webpack.optimize.OccurenceOrderPlugin()
	);

	webpack(prodConfig, function (err, stats) {
		if (err) throw new gutil.PluginError('webpack', err);
		gutil.log('[webpack]', stats.toString({
			colors: true
		}));
		callback();
	});
});

// Sass for development
gulp.task('sass:dev', function ( ) {
	return sass('./client/src/sass/', { sourcemap: true })
		.on('error', function (err) {
			console.error('Error!', err.message);
		})
		.pipe(prefix('last 2 versions', '> 1%'))
		.pipe(gulp.dest('./client/dev/assets/css/'));
});

// Sass for production
gulp.task('sass:prod', function ( ) {
	var revAll = new RevAll();

	return sass('./client/src/sass/', { sourcemap: false, style: 'compact' })
		.on('error', function (err) {
			console.error('Error!', err.message);
		})
		.pipe(prefix('last 2 versions', '> 1%'))
		.pipe(gulp.dest('./client/dist/assets/css/'));
});

// Watcher for Sass
var watcher = gulp.watch('./client/src/sass/**/*.scss', ['sass:dev']);
watcher.on('change', function (event) {
	console.log('File ' + event.path + ' was ' + event.type + ', running tasks...');
});

// SVG Store
gulp.task('svgstore', function () {
	function fileContents (filePath, file) {
		return file.contents.toString('utf8')
	}

	var svgs = gulp.src('./client/dev/assets/img/sprite/*.svg')
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
})

// Compress and move images
gulp.task('images-assets', function ( ) {
	return gulp.src('./client/dev/assets/img/*.{gif,jpg,png,svg}')
		.pipe(newer('./client/dist/assets/img/'))
		.pipe(cache(imagemin({
			progressive: true,
			use: [pngcrush()]
		})))
		.pipe(gulp.dest('./client/dist/assets/img/'));
});

gulp.task('images-media', function ( ) {
	return gulp.src('./client/dev/media/img/*.{gif,jpg,png,svg}')
		.pipe(newer('./client/dist/media/img/'))
		.pipe(gulp.dest('./client/dist/media/img/'));
});

gulp.task('videos-media', function ( ) {
	return gulp.src('./client/dev/media/video/*')
		.pipe(newer('./client/dist/media/video/'))
		.pipe(gulp.dest('./client/dist/media/video/'));
});

// Move entire audio folder to static dist
gulp.task('audio', function ( ) {
	return gulp.src('./client/dev/media/audio/*')
		.pipe(newer('./client/dist/media/audio/'))
		.pipe(gulp.dest('./client/dist/media/audio/'));
});

// Amazon S3
gulp.task('publish', function ( ) {
	var headers = {'Cache-Control': 'max-age=315360000, no-transform, public'};
	var aws = require('./config/private/aws.json');
	var publisher = awspublish.create(aws);
	var revAll = new RevAll({
		transformFilename: function (file, hash) {
			var ext = path.extname(file.path);
			return path.basename(file.path, ext) + '-' + hash.substr(0, 8) + ext;
		}
	});

	// Regular content: mainly media
	var regular = gulp.src(['./client/dist/**/*', '!./client/dist/**/*.{css,js,woff}'])
		.pipe(publisher.publish(headers))
		.pipe(publisher.cache())
		.pipe(awspublish.reporter())
		.pipe(cloudfront(aws));

	// Gzipped content: asset files
	var gzip = gulp.src('./client/dist/**/*.{css,js,woff}')
		.pipe(revAll.revision())
		.pipe(gulp.dest('./client/dist/'))
		.pipe(revAll.manifestFile())
		.pipe(gulp.dest('./client/dist/assets/'))
		.pipe(awspublish.gzip())
		.pipe(publisher.publish(headers))
		.pipe(publisher.cache())
		.pipe(awspublish.reporter())
		.pipe(cloudfront(aws));

	return merge(regular, gzip);
});

gulp.task('publish-media', function ( ) {
	var headers = {'Cache-Control': 'max-age=315360000, no-transform, public'};
	var aws = require('./config/private/aws.json');
	var publisher = awspublish.create(aws);

	return gulp.src('./client/dist/media/**/*')
		.pipe(publisher.publish(headers))
		.pipe(publisher.cache())
		.pipe(awspublish.reporter())
		.pipe(cloudfront(aws));
});

gulp.task('default', function ( ) {
	gulp.start('sass:dev');
});

// Run deploy task for media folder
gulp.task('deploy-media', function ( ) {
	gulp.start('images-media', 'videos-media', 'audio', 'publish-media');
});

// Run deploy task for assets
gulp.task('deploy', function ( ) {
	gulp.start('webpack:prod', 'sass:prod', 'images-assets', 'publish');
});