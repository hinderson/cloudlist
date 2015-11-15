'use strict';

var db = require('../server').db;
var fs = require('fs');
var request = require('request');
var crypto = require('crypto');
var path = require('path');
var slugify = require('../utils/slugify.js');
var async = require('async');
var ObjectId = require('mongoskin').ObjectID;
var jsonpClient = require('jsonp-client');
var config = require('config');

// Graphicsmagick
var gm = require('gm').subClass({imageMagick: true});

// FFMPEG
var ffmpeg = require('fluent-ffmpeg');
var probe = require('node-ffprobe');

// Methods
var collections = require('./collections.js');

// Constructor
var songs = {};

songs = {

	getAll: function (id, result) {

	},

	getOne: function (id, callback) {
		if (id === null) { return false; }

		db.collection('songs').find( { _id: new ObjectId(id) } ).toArray(function (err, song) {
			if (err || song === undefined || song.length === 0) return callback(false);

			return callback(song[0]);
		});
	},

	create: function (collectionId, args, files, result) {
		var songArtist = args.artist || null;
		var songFeatured = args.featuredartist || null;
		var songTitle = args.title || null;
		var songAlbum = args.album || null;
		var songDuration = null;
		var audioUrl = files.audio ? files.audio.name : null;
		var streamUrl = args.soundcloud || null;
		var startTime = args.starttime || 0;
		var endTime = args.endtime;
		var resolvedUrl = null;
		var gradientPlaceholder = args.gradientplaceholder || null;

		var tempCoverPath = files.image ? files.image.path : null;
		var tempFilename = files.image ? files.image.name : null;
		var targetCoverPath;

		// Trim user inputs
		songArtist && songArtist.trim();
		songFeatured && songFeatured.trim();
		songTitle && songTitle.trim();
		songAlbum && songAlbum.trim();

		function determineAudioSource (callback) {
			// First resolve the URL if it's Soundcloud
			// Be sure to check for // in the beginning so we don't return true on api.soundcloud
			if (streamUrl && streamUrl.indexOf('//soundcloud.com') > -1) {
				jsonpClient('https://api.soundcloud.com/resolve?url=' + streamUrl + '&format=json&consumer_key=' + config.get('soundCloudKey'), function (err, data) {
					if (err) throw err;

					// Update resolved URL variable
					resolvedUrl = data.stream_url;

					if (!resolvedUrl) {
						console.log('Stream url not found');
						throw err;
					}

					// Update song duration variable
					songDuration = data.duration;

					callback(null);
				});
			} else if (audioUrl) {
				// Analyze audio duration and move the file
				var tempAudioPath = files.audio.path;
				var targetAudioPath = './client/media/audio/' + files.audio.name;

				fs.rename(tempAudioPath, targetAudioPath, function (err) {
					if (err) throw err;

					// Delete the temporary file
					fs.unlink(tempAudioPath, function() {
						if (err) throw err;

						// Read duration data
						probe(targetAudioPath, function (err, res) {
							if (err) throw err;

							// Update song duration variable
							songDuration = res.format.duration * 1000; // Converted to milliseconds to match SoundCloud API

							callback(null);
						});
					});
				});
			} else {
				callback(null);
			}
		}

		function processImageSearchResults (callback) {
			var image = args.image || null;
			if (!image) {
				return callback(null);
			}

			var downloadImage = function (sourceUrl, dest, cb) {
				var file = request
					.get(sourceUrl)
					.on('error', function(err) {
						fs.unlink(dest);
					})
					.pipe(fs.createWriteStream(dest));

				file.on('finish', function ( ) {
					file.close(cb(file));  // close() is async, call cb after close completes.
				});
			};

			tempFilename = crypto.randomBytes(16).toString('hex');
			downloadImage(image, './tmp/' + tempFilename, function (file) {
				tempCoverPath = file.path;

				callback(null);
			});
		}

		function identifyCoverType (callback) {
			if (!tempCoverPath) { return callback(null); }

			var ext = path.extname(tempCoverPath);
			var filename = ext ? tempFilename.replace(ext, (ext === '.gif' ? '.gif' : '.jpg')) : (tempFilename + (ext === '.gif' ? '.gif' : '.jpg')); // If there is no extension
			targetCoverPath = './client/media/img/' + filename;

			async.waterfall([
			    function (next) {
					// Create large (or maybe medium?) cover
					gm(tempCoverPath)
						.resize(435, 420) // Max 435px on either side, but otherwise automatically keeps its aspect ratio
						.noProfile()
						.setFormat(ext === '.gif' ? 'gif' : 'jpg')
						.quality(90)
						.write(tempCoverPath, function (err) {
							if (err) throw err;

							return next(null);
						});
			    },
			    function (next) {
					// Identify the image
					gm(ext === '.gif' ? tempCoverPath + '[0]' : tempCoverPath).identify(function (err, identify) {
						if (err) throw err;

						return next(null, identify);
					});
			    },
				function (identify, next) {
					// Identifies the dominant color of the image
					gm(ext === '.gif' ? tempCoverPath + '[0]' : tempCoverPath).identify('%[pixel:s]', function (err, dominantColor) {
						if (err) throw err;

						// Determines if contrast should be dark or bright
						function getContrastYIQ (rgb) {
							var r = rgb[0];
							var g = rgb[1];
							var b = rgb[2];
							var yiq = ((r*299)+(g*587)+(b*114))/1000;
							return (yiq >= 128) ? 'dark' : 'bright';
						}

						// Darkens or brightens the original color
						function luminance (c, n, i, d) {
							for (i=3;i--;c[i]=d<0?0:d>255?255:d|0)d=c[i]+n;
							return c;
						}

						var rgb = dominantColor
							.replace('srgb(', '')
							.replace(')', '')
							.split(',').map(function (x) {
								return parseInt(x);
							});

						var contrast = getContrastYIQ(rgb.slice(0));

						identify.primaryColor = rgb;
						identify.secondaryColor = luminance(rgb.slice(0), contrast === 'dark' ? -160 : 160);
						identify.colorContrast = contrast;
						return next(null, identify);
					});
				},
				function (identify, next) {
					// Create placeholder
					var placeholderFilename = crypto.randomBytes(16).toString('hex') + '.jpg';
					var placeholderFile = './client/media/img/' + placeholderFilename;
					gm(ext === '.gif' ? tempCoverPath + '[0]' : tempCoverPath)
						.resize(30, 30) // Max 30px on either height or width
						.setFormat('jpg')
						.quality(90)
						.write(placeholderFile, function (err) {
							if (err) throw err;

							gm(placeholderFile).identify(function (err, placeholder) {
								if (err) throw err;

								identify.placeholder = {
									filename: placeholderFilename,
									width: placeholder.size.width,
									height: placeholder.size.height,
									filesize: placeholder.Filesize
								};

								next(null, identify);
							});
						});
				}
			], function (err, identify) {
				if (err) throw err;

				var songCover = {
					format: identify.format,
					filename: filename,
					width: identify.size.width,
					height: identify.size.height,
					filesize: identify.Filesize,
					placeholder: identify.placeholder,
					colors: {
						primary: identify.primaryColor,
						secondary: identify.secondaryColor,
						contrast: identify.colorContrast,
						gradient: gradientPlaceholder
					}
				};

				return callback(null, songCover);
			});
		}

		function processCover (callback) {
			if (!tempCoverPath) { return callback(null); }

			// Rename temporary file
			fs.rename(tempCoverPath, targetCoverPath, function (err) {
				if (err) throw err;

				return callback(null);
			});
		}

		function processCoverVideo (callback) {
			if (path.extname(targetCoverPath) !== '.gif') { return callback(null); }

			var videoFileName = crypto.randomBytes(16).toString('hex') + '.mp4';
			ffmpeg(targetCoverPath)
				.size('100%') // Needs explicit size to work with -pix_fmt
				.noAudio()
				.videoBitrate('2048k')
				.outputOptions('-pix_fmt yuv420p') // Needed to work in Quicktime
				.save('./client/media/video/' + videoFileName)
				.on('error', function (err, stdout, stderr) {
					if (err) throw err;
					return callback(null);
				})
				.on('end', function ( ) {
					console.log('Finished processing video gif', videoFileName);

					ffmpeg.ffprobe('./client/media/video/' + videoFileName, function (err, metadata) {
						if (err) throw err;

						function humanFileSize (size) {
							var i = Math.floor( Math.log(size) / Math.log(1024) );
							return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ['B', 'KB', 'MB', 'GB', 'TB'][i];
						}

						// Create screenshot
						var screenshotFilename = crypto.randomBytes(16).toString('hex') + '.jpg';
						gm(targetCoverPath + '[0]')
							.resize(435, 420)
							.setFormat('jpg')
							.quality(90)
							.write('./client/media/img/' + screenshotFilename, function (err) {
								if (err) throw err;

								var videoSchema = {
									filename: videoFileName,
									width: metadata.streams[0].width,
									height: metadata.streams[0].height,
									filesize: humanFileSize(metadata.format.size),
									screenshot: screenshotFilename
								};
								return callback(null, videoSchema);
							});
					});
				});
		}

		function formatInputFields (callback) {
			// Check for multiple artists
			if (songArtist && songArtist.indexOf(',') > -1) {
				songArtist = songArtist.split(/\s*,\s*/);
			}

			// Check for multiple featured artists
			if (songFeatured && songFeatured.indexOf(',') > -1) {
				songFeatured = songFeatured.split(/\s*,\s*/);
			}

			return callback(null);
		}

		function postToDb (err, songCover) {
			if (err) throw err;

			var slugs = {
				album: songAlbum && slugify(songAlbum),
				artist: songArtist && slugify((Array.isArray(songArtist) ? songArtist.join('-') : songArtist) + (songFeatured && songFeatured.length > 0 ? (' feat. ' + (Array.isArray(songFeatured) ? songFeatured.join('-') : songFeatured )) : '')),
				title: songTitle && slugify(songTitle)
			};

			var song = {
				'added': new Date(),
				'album': songAlbum,
				'artist' : songArtist,
				'audio': {
					'source': streamUrl ? 'soundcloud' : 'file',
					'url': streamUrl ? streamUrl : audioUrl,
					'stream': resolvedUrl,
					'starttime': startTime,
					'endtime': endTime || songDuration,
					'duration': songDuration
				},
				'available': true,
				'featuredartist': songFeatured,
				'covers': [songCover[2]],
				'slugs': {
					'album': slugs.album,
					'artist': slugs.artist,
					'title': slugs.title
				},
				'permalink': slugs.artist + '-' + slugs.title,
				'tags': null,
				'title': songTitle
			};

			if (songCover[4]) {
				song.covers[0].video = songCover[4];
			}

			// Submit to the DB
			db.collection('songs').insert(song, function (err, doc) {
				if (err) throw err;

				// Fetch newly created song id
				var songId = doc[0]._id + '';

				collections.getOne({ 'id': collectionId }, function (data) {
					var items = data.collection.items;
					// Push newly created song to the items array
					items.push(songId);

					// Update collection with the new id
					collections.update(collectionId, { 'items': items }, function ( ) {
						console.log('Added ' + songId +' to collection ' + collectionId);

						if (typeof(result) === 'function') {
							return result(song);
						}
					});

					// Generate covers montage if song is in place 1-4
					if (items.indexOf(songId) < 4) {
						collections.createCoversMontage(collectionId);
					}
				});
			});
		}

		// Main async chain
		async.series([
			determineAudioSource,
			processImageSearchResults,
			identifyCoverType,
			processCover,
			processCoverVideo,
			formatInputFields
		], postToDb);
	},

	update: function (id, args, result) {
		if (!id) { return false; }

		console.log('update', args);

		var field = args.field;
		var content = args.content;

		var query = { updated: new Date() };

		if (field === 'available') {
			query[field] = (content === 'true' ? true: false);
		} else {
			query[field] = content;
		}

		db.collection('songs').update({ _id: new ObjectId(id) }, { '$set': query }, function (err) {
			if (err) throw err;

			if (typeof(result) === 'function') {
				return result();
			}
		});
	},

	delete: function (id, result) {
		if (!id) { return false; }

		async.waterfall([
			function (callback) {
				// Remove song from database
				db.collection('songs').findAndRemove( { _id: new ObjectId(id) }, [], callback);
			},
			function (song, sort, callback) {
				// Remove all associated files (audio files, images, etc.)
				if (song.covers) {
					var source = song.covers[0].filename;
					var ext = path.extname(source).slice(1);
					fs.unlink('./client/media/' +  (ext === 'mp4' ? 'video/' : 'img/') + song.covers[0].filename);

					if (song.covers[0].placeholder) {
						fs.unlink('./client/media/img/' + song.covers[0].placeholder.filename);
					}

					if (song.covers[0].video) {
						fs.unlink('./client/media/video/' + song.covers[0].video.filename);
						fs.unlink('./client/media/img/' + song.covers[0].video.screenshot);
					}
				}

				if (song.audio && song.audio.url && song.audio.source !== 'soundcloud') {
					fs.unlink('./client/media/audio/' + song.audio.url);
				}

				callback();
			},
			function (callback) {
				// Return an array of collections that associates with the song
				db.collection('collections').find({ items: id }).toArray(function (err, collections) {
					// Delete every reference to the song from item array
					collections.forEach(function (collection) {
						var collectionId = collection._id;
						db.collection('collections').update( { _id: new ObjectId(collectionId) }, { $pull: { items: id } }, callback);
					});
				});
			}
		], function (err) {
			if (err) throw err;

			if (typeof(result) === 'function') {
				return result(true);
			}
		});
	}

};

module.exports = songs;
