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

// Graphicsmagick
var gm = require('gm');

// FFMPEG
var ffmpeg = require('fluent-ffmpeg');
var probe = require('node-ffprobe');

module.exports = {

	getAll: function (id, result) {

	},

	getOne: function (id, result) {

	},

	create: function (collectionId, args, files, result) {
		var songArtist = args.artist.trim() || null;
		var songFeatured = args.featuredartist.trim() || null;
		var songTitle = args.title.trim() || null;
		var songAlbum = args.album.trim() || null;
		var songDuration = null;
		var songImage = files.image ? files.image.name : null;
		var songCover;
		var audioUrl = files.audio ? files.audio.name : null;
		var streamUrl = args.soundcloud || null;
		var startTime = args.starttime || 0;
		var endTime = args.endtime;
		var resolvedUrl = null;

		var tempCoverPath = files.image ? files.image.path : null;
		var tempFilename = files.image ? files.image.name : null;
		var targetCoverPath;

		// Main async chain
		async.series({

			determineAudioSource: function (callback) {

				// First resolve the URL if it's Soundcloud
				// Be sure to check for // in the beginning so we don't return true on api.soundcloud
				if (streamUrl && streamUrl.indexOf('//soundcloud.com') > -1) {
					var consumerKey = '879664becb66c01bf10c8cf0fd4fbec3';
					jsonpClient('https://api.soundcloud.com/resolve?url=' + streamUrl + '&format=json&consumer_key=' + consumerKey, function (err, data) {
						if (err) throw err;

						// Update song duration variable
						songDuration = data.duration;

						// Update resolved URL variable
						resolvedUrl = data.stream_url;

						callback(null);
					});

				} else if (audioUrl) {

					// Analyze audio duration and move the file
					var tempAudioPath = files.audio.path;
					var targetAudioPath = './public/media/audio/' + files.audio.name;

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
			},

			processImageSearchResults: function (callback) {
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
			},

			identifyCoverType: function (callback) {
				if (!tempCoverPath) {
					return callback(null);
				}

				// First check if we're dealing with an image or a video
				var ext = path.extname(tempCoverPath);
				if (ext !== '.mp4') {
					var filename = ext ? tempFilename.replace(ext, '.jpg') : (tempFilename + '.jpg'); // If there is no extension
					targetCoverPath = './public/media/img/' + filename;

					// Resize img
					gm(tempCoverPath).size(function (err, sizes) {

						// Determine size
						var width;
						var height;
						if (sizes.width > sizes.height) {
							width = sizes.width < 400 ? null : 400;
							height = 260;
						} else {
							width = 280;
							height = sizes.height < 400 ? null : 400;
						}

						gm(tempCoverPath)
							.resize(width, height) // Automatically keeps its ratio
							.noProfile()
							.setFormat('jpg')
							.quality(90)
							.write(tempCoverPath, function (err) {
								if (err) throw err;

								gm(tempCoverPath).identify(function (err, identify) {
									if (err) throw err;

									songCover = {
										format: identify.format,
										filename: filename,
										width: identify.size.width,
										height: identify.size.height,
										filesize: identify.Filesize
									};

									callback(null);
								});
							});
					});
				} else { // Upload mp4
					targetCoverPath = './public/media/video/' + files.image.name;
					var screenshotFolder = './public/media/img/';

					// Take screenshot
					var screenshot;
					ffmpeg(tempCoverPath)
						.screenshots({
							filename: '%b', // Expression means input basename (filename w/o extension)
							count: 1,
							timemarks: [ "50%" ], // The point at which to take the screenshot
							folder: screenshotFolder // Output path
						})
						.on('filenames', function (filenames) {
							screenshot = filenames;
						})
						.on('end', function ( ) {

							var newScreenshot = screenshot[0].replace(path.extname(screenshot[0]), '.jpg');
							var tempScreenshot = screenshotFolder + screenshot[0];
							var targetScreenshot = screenshotFolder + newScreenshot;

							// Convert PNG screenshot to JPG
							gm(tempScreenshot)
								.setFormat('jpg')
								.quality(90)
								.write(tempScreenshot, function (err) {
									if (err) throw err;

									// Rename the temporary PNG file
									fs.rename(tempScreenshot, targetScreenshot, function (err) {
										if (err) throw err;

										// Delete the temporary file
										fs.unlink(tempScreenshot, function() {
											if (err) throw err;

											// Read metadata
											ffmpeg.ffprobe(tempCoverPath, function (err, metadata) {
												if (err) throw err;

												songCover = {
													format: 'MP4',
													src: songImage,
													width: metadata.streams[0].width,
													height: metadata.streams[0].height,
													filesize: metadata.format.size,
													screenshot: newScreenshot
												};

												callback(null);
											});
										});

									});

								});
						});
				}
			},

			processCover: function (callback) {
				if (!tempCoverPath) {
					return callback(null);
				}

				fs.rename(tempCoverPath, targetCoverPath, function (err) {
					if (err) throw err;

					// Delete the temporary file
					fs.unlink(tempCoverPath, function() {
						if (err) throw err;

						callback(null);
					});
				});
			},

			formatInputFields: function (callback) {
				// Check for multiple artists
				if (songArtist && songArtist.indexOf(',') > -1) {
					songArtist = songArtist.split(/\s*,\s*/);
				}

				// Check for multiple featured artists
				if (songFeatured && songFeatured.indexOf(',') > -1) {
					songFeatured = songFeatured.split(/\s*,\s*/);
				}

				callback(null);
			}

		}, function (err) {
			if (err) throw err;

			// First count the length of the database
			db.collection('songs').count(function (err, count) {
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
					'covers': [songCover],
					'slugs': {
						'album': slugs.album,
						'artist': slugs.artist,
						'title': slugs.title
					},
					'permalink': slugs.artist + '-' + slugs.title,
					'tags': null,
					'title': songTitle
				};

				// Submit to the DB
				db.collection('songs').insert(song, function (err, doc) {
					if (err) throw err;

					// Add newly added song to the collection document
					var songId = doc[0]._id + '';
					console.log(collectionId);
					db.collection('collections').update(
						{ _id: ObjectId(collectionId) }, // Find accompanying collection based on slug id
						{ $push: { items: songId } // Push newly created songId to items array
						}, function (err, doc) {
							if (err) throw err;

							return result(song);
						}
					);
				});
			});

		});
	},

	update: function (id, args, result) {
		if (!id) { return false; }

		var field = args.field;
		var content = args.content;

		var query = {
			updated: new Date()
		};

		if (field === 'available') {
			query[field] = (content === 'true' ? true: false);
		} else {
			query[field] = content;
		}

		db.collection('songs').update({ _id: ObjectId(id) }, { '$set': query }, function (err) {
			if (err) throw err;

			return result(true);
		});
	},

	delete: function (id, result) {
		if (!id) { return false; }

		async.waterfall([
			function (callback) {
				// Remove song from database
				db.collection('songs').findAndRemove( { _id: ObjectId(id) }, [], callback);
			},
			function (song, sort, callback) {
				// Remove all associated files (audio files, images, etc.)
				if (song.covers) {
					var source = song.covers[0].filename;
					var ext = path.extname(source).slice(1);
					fs.unlink('./public/media/' +  (ext === 'mp4' ? 'video/' : 'img/') + song.covers[0].filename);
				}

				if (song.audio && song.audio.url && song.audio.source !== 'soundcloud') {
					fs.unlink('./public/media/audio/' + song.audio.url);
				}

				callback();
			},
			function (callback) {
				// Return an array of collections that associates with the song
				db.collection('collections').find({ items: id }).toArray(function (err, collections) {
					// Delete every reference to the song from item array
					collections.forEach(function (collection) {
						var collectionId = collection._id;
						db.collection('collections').update( { _id: ObjectId(collectionId) }, { $pull: { items: id } }, callback);
					});
				});
			}
		], function (err) {
			if (err) throw err;

			return result(true);
		});
	}

};