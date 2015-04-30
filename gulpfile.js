var gulp = require('gulp');
var sass = require('gulp-ruby-sass');
var sourcemaps = require('gulp-sourcemaps');
var prefix = require('gulp-autoprefixer');
var imagemin = require('gulp-imagemin');
var pngcrush = require('imagemin-pngcrush');
var cache = require('gulp-cache');
var jshint = require('gulp-jshint');
var notify = require('gulp-notify');
var rename = require('gulp-rename');
var newer = require('gulp-newer');
var merge = require('merge-stream');
var rev = require('gulp-rev');

var awspublish = require('gulp-awspublish');
var cloudfront = require("gulp-cloudfront");
var replace = require("gulp-replace");

var svgstore = require('gulp-svgstore');
var svgmin = require('gulp-svgmin');

// Sass
gulp.task('sass', function() {
	return sass('./source/sass/', {sourcemap: true, style: 'compact'})
		.on('error', function (err) {
			console.error('Error!', err.message);
		})
		.pipe(prefix('last 2 versions', '> 1%'))
		.pipe(gulp.dest('./public/assets/css/'));
});

// Watcher for Sass
var watcher = gulp.watch('./source/sass/**/*.scss', ['sass']);
watcher.on('change', function (event) {
	console.log('File ' + event.path + ' was ' + event.type + ', running tasks...');
});

// SVG Store
gulp.task('svgstore', function () {
	function fileContents (filePath, file) {
		return file.contents.toString('utf8')
	}

	var svgs = gulp.src('./public/assets/img/sprite/*.svg')
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

// JSHint scripts
gulp.task('jshint', function ( ) {
	return gulp.src(['public/assets/js/admin/*.js', 'public/assets/js/*.js'])
		.pipe(jshint())
		.pipe(jshint.reporter( 'default' ))
});

// Compress and move images
gulp.task('images-assets', function ( ) {
	return gulp.src('./public/assets/img/*.{gif,jpg,png,svg}')
		.pipe(newer('./cdn/assets/img/'))
		.pipe(cache(imagemin({
			progressive: true,
			use: [pngcrush()]
		})))
		.pipe(gulp.dest('./cdn/assets/img/'));
});

gulp.task('images-media', function ( ) {
	return gulp.src('./public/media/img/*.{gif,jpg,png,svg}')
		.pipe(newer('./cdn/media/img/'))
		.pipe(gulp.dest('./cdn/media/img/'));
});

gulp.task('videos-media', function ( ) {
	return gulp.src('./public/media/video/*')
		.pipe(newer('./cdn/media/video/'))
		.pipe(gulp.dest('./cdn/media/video/'));
});

// Move entire audio folder to static dist
gulp.task('audio', function ( ) {
	return gulp.src('./public/media/audio/*')
		.pipe(newer('./cdn/media/audio/'))
		.pipe(gulp.dest('./cdn/media/audio/'));
});

// Amazon S3
gulp.task('publish', function ( ) {
	var headers = {'Cache-Control': 'max-age=315360000, no-transform, public'};
	var aws = require('./config/private/aws.json');
	var publisher = awspublish.create(aws);

	var regular = gulp.src(['./cdn/**/*', '!./cdn/**/*.{css,js,woff}'])
		.pipe(publisher.publish(headers))
		.pipe(publisher.cache())
		.pipe(awspublish.reporter())
		.pipe(cloudfront(aws));

	var gzip = gulp.src('./cdn/**/*.{css,js,woff}')
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

	return gulp.src(['./cdn/**/*', '!./cdn/assets/**'])
		.pipe(publisher.publish(headers))
		.pipe(publisher.cache())
		.pipe(awspublish.reporter())
		.pipe(cloudfront(aws));
});

gulp.task('default', function ( ) {
	gulp.start('sass');
});

// Run deploy task for media folder
gulp.task('deploy-media', function ( ) {
	gulp.start('images-media', 'videos-media', 'audio', 'publish-media');
});

// Run deploy task for assets and inject versioned file paths in relevant documents
gulp.task('deploy', function ( ) {
	gulp.start('styles', 'scripts', 'images-assets', 'publish');
});