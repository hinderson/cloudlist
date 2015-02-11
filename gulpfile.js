var gulp = require('gulp');
var imagemin = require('gulp-imagemin');
var pngcrush = require('imagemin-pngcrush');
var minifyCSS = require('gulp-minify-css');
var cache = require('gulp-cache');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var jshint = require('gulp-jshint');
var notify = require('gulp-notify');
var rename = require('gulp-rename');
var newer = require('gulp-newer');
var merge = require('merge-stream');
var rev = require('gulp-rev');
var awspublish = require('gulp-awspublish');
var cloudfront = require("gulp-cloudfront");
var inject = require("gulp-inject");
var replace = require("gulp-replace");
var svgstore = require('gulp-svgstore');
var svgmin = require('gulp-svgmin');

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

// Concat and minify styles
gulp.task('styles', function ( ) {
	return gulp.src([
			'public/assets/css/normalize.css',
			'public/assets/css/fonts.css',
			'public/assets/css/typography.css',
			'public/assets/css/animate.css',
			'public/assets/css/main.css'
		])
		.pipe(minifyCSS({ keepSpecialComments: 0 }))
		.pipe(concat( 'cloudlist.css' ))
		.pipe(rev())
		.pipe(gulp.dest( './cdn/assets/css/' ))
		.pipe(rev.manifest())
		.pipe(gulp.dest( './cdn/assets/css/' ))
		.pipe(notify({ message: 'Styles task complete' }));
});

// Concat and minify scripts
gulp.task('scripts', function ( ) {
	return gulp.src([
			'public/assets/js/libs/*.js',
			'public/assets/js/utils.js',
			'public/assets/js/main.js',
			'public/assets/js/history.js',
			'public/assets/js/animate.js',
			'public/assets/js/audio.js',
			'public/assets/js/init.js'
		])
		.pipe(concat( 'global.js' ))
		.pipe(rev())
		.pipe(uglify({
			compress:{
				pure_funcs: [ 'console.log' ] // Removes console.log
			}
		}))
		.pipe(gulp.dest( './cdn/assets/js/' ))
		.pipe(rev.manifest())
		.pipe(gulp.dest( './cdn/assets/js/' ))
		.pipe(notify({ message: 'Scripts has been concated and minified' }));
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
	var aws = require('./data/aws.json');
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
	var aws = require('./data/aws.json');
	var publisher = awspublish.create(aws);

	return gulp.src(['./cdn/**/*', '!./cdn/assets/**'])
		.pipe(publisher.publish(headers))
		.pipe(publisher.cache())
		.pipe(awspublish.reporter())
		.pipe(cloudfront(aws));
});

gulp.task('inject', function ( ) {
	var cdn = 'https://static.cloudlist.io';
	var css = require('./cdn/assets/css/rev-manifest.json');
	css = css[Object.keys(css)[0]];
	var js = require('./cdn/assets/js/rev-manifest.json');
	js = js[Object.keys(js)[0]];

	return gulp.src('./views/layout.jade')
		.pipe(inject(gulp.src(['./cdn/**/' + css, './cdn/**/' + js], {read: false}),
			{ignorePath: 'cdn', addPrefix: cdn, addRootSlash: false}))
		.pipe(gulp.dest('./views'));
});

gulp.task('default', function ( ) {
	gulp.start('jshint');
});

// Run deploy task for media folder
gulp.task('deploy-media', function ( ) {
	gulp.start('images-media', 'videos-media', 'audio', 'publish-media');
});

// Run deploy task for assets and inject versioned file paths in relevant documents
gulp.task('deploy', function ( ) {
	gulp.start('styles', 'scripts', 'images-assets', 'publish', 'inject');
});