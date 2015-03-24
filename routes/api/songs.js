// General
var fs = require('fs');
var path = require('path');
var async = require('async');
var slugify = require('../../utils/slugify.js');
var ObjectId = require('mongoskin').ObjectID;
var parseUrl = require('url');
var jsonpClient = require('jsonp-client');

// Graphicsmagick
var gm = require('gm');

// FFMPEG
var ffmpeg = require('fluent-ffmpeg');
var probe = require('node-ffprobe');

module.exports = function (router) {

	// GET all songs
	router.get('/api/songs/', function (req, res) {
		var db = req.db;
		var collectionId = req.params.id;

		var url = parseUrl.parse(req.headers.referer);
		console.log('Calling', url.pathname.split('/'));

		return;

		var env = process.env.NODE_ENV;
		if ('production' === env) {
			var oneYear = 31556952000;
			res.header('Cache-Control', 'max-age=' + oneYear);
		}

		// Find the correct collection based on ID
		db.collection('collections').find( { _id: ObjectId(collectionId) } ).toArray(function (err, collection) {

			// Turn items into ObjectId's
			var items = collection[0].items;
			for (var i = 0, len = items.length; i < len; i++) {
				items[i] = ObjectId(items[i]);
			}

			// Match songs that are contained within the collection's items array
			db.collection('songs').find( { _id: { $in: items } } ).toArray(function (err, items) {
				res.json({
					'order': collection[0] && collection[0].items || null,
					'items': items
				});
			});
		});
	});

	// POST new (single) song
	router.post('/addsong', function (req, res) {

		var db = req.db;

		var collectionId = req.body.collection; // Based on slug ID, not ObjectId

		var songArtist = req.body.artist || null;
		var songFeatured = req.body.featuredartist || null;
		var songTitle = req.body.title || null;
		var songAlbum = req.body.album || null;
		var songDuration = null;
		var songImage = req.files.image ? req.files.image.name : null;
		var songCover;
		var audioUrl = req.files.audio ? req.files.audio.name : null;
		var streamUrl = req.body.soundcloud || null;
		var startTime = req.body.starttime || 0;
		var endTime = req.body.endtime;
		var resolvedUrl = null;

		var tempCoverPath;
		var targetCoverPath;

		// Main async chain
		async.series({

			determineAudioSource: function (next) {

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

						next(null);
					});

				} else if (audioUrl) {

					// Analyze audio duration and move the file
					var tempAudioPath = req.files.audio.path;
					var targetAudioPath = './public/media/audio/' + req.files.audio.name;

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

								next(null);
							});
						});
					});

				} else {

					next(null);

				}
			},

			identifyCover: function (next) {
				if (!songImage) {
					next(null);
				}

				tempCoverPath = req.files.image.path;

				// First check if we're dealing with an image or a video
				var ext = path.extname(req.files.image.name);
				if (ext !== '.mp4') {
					var filename = req.files.image.name.replace(ext, '.jpg');
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

									next(null);
								});
							});
					});
				} else { // Upload mp4
					targetCoverPath = './public/media/video/' + req.files.image.name;
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

												next(null);
											});
										});

									});

								});
						});
				}
			},

			processCover: function (next) {
				if (!songImage) {
					next(null);
				}

				fs.rename(tempCoverPath, targetCoverPath, function (err) {
					if (err) throw err;

					// Delete the temporary file
					fs.unlink(tempCoverPath, function() {
						if (err) throw err;

						next(null);
					});
				});
			},

			formatInputFields: function (next) {
				// Check for multiple artists
				if (songArtist && songArtist.indexOf(',') > -1) {
					songArtist = songArtist.split(/\s*,\s*/);
				}

				// Check for multiple featured artists
				if (songFeatured && songFeatured.indexOf(',') > -1) {
					songFeatured = songFeatured.split(/\s*,\s*/);
				}

				next(null);
			}

		}, function (err, result) {
			if (err) throw err;

			// First count the length of the database
			db.collection('songs').count(function (err, count) {
				if (err) throw err;

				// Submit to the DB
				db.collection('songs').insert({
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
						'album': songAlbum && slugify(songAlbum),
						'artist': songArtist && slugify((Array.isArray(songArtist) ? songArtist.join('-') : songArtist) + (songFeatured && songFeatured.length > 0 ? (' feat. ' + (Array.isArray(songFeatured) ? songFeatured.join('-') : songFeatured )) : '')),
						'title': songTitle && slugify(songTitle)
					},
					'tags': null,
					'title': songTitle
				}, function (err, doc) {
					if (err) {
						// If it failed, return error
						res.send("There was a problem adding the information to the database.");
					} else {

						// Add newly added song to the collection document
						var songId = doc[0]._id + '';
						db.collection('collections').update(
							{ 'slugs.id': collectionId }, // Find accompanying collection based on slug id
							{ $push: { items: songId } // Push newly created songId to items array
							}, function (err, doc) {
								if (err) throw err;

								// If it worked, set the header so the address bar doesn't still say /adduser
								res.location('playlist/' + collectionId);
								// And forward to success page
								res.redirect('playlist/' + collectionId);
							}
						);
					}
				});
			});

		});

	});

	// PUT existing song
	router.put('/updateitem/', function (req, res) {
		var db = req.db;
		var id = req.body.id;
		var field = req.body.field;
		var content = req.body.content;

		var query = {};
		if (field === 'available') {
			query[field] = (content === 'true' ? true: false);
		} else {
			query[field] = content;
		}
		query.updated = new Date();

		console.log('Changed the following to ' + id + ':', field, content);

		db.collection('songs').update({_id: ObjectId(id)}, {'$set': query}, function (err, result) {
			if (err) throw err;

			res.send((result === 1) ? { msg: '' } : { msg:'error: ' + err });
		});
	});

	// DELETE existing song
	router.delete('/deletesong/', function (req, res) {
		var db = req.db;

		var songToDelete = req.body.songId;
		var collectionId = req.body.collectionId;

		function deleteAssociatedFiles (song) {

			if (song[0].covers) {
				var source = song[0].covers[0].filename;
				var ext = path.extname(source).slice(1);
				console.log(ext + 'to delete');
				fs.unlink('./public/media/' +  (ext === 'mp4' ? 'video/' : 'img/') + song[0].covers[0].filename);
			}

			if (song[0].audio && song[0].audio.url && song[0].audio.source !== 'soundcloud') {
				fs.unlink('./public/media/audio/' + song[0].audio.url);
			}
		}

		// Remove song from songs
		db.collection('songs').find( { _id: ObjectId(songToDelete) } ).toArray(function (err, song) {
			if (err) throw err;

			deleteAssociatedFiles(song);

			// Remove song from collection
			db.collection('collections').update( { _id: ObjectId(collectionId) }, { $pull: { items: songToDelete } }, function (err, result) {
				res.send((result === 1) ? { msg: '' } : { msg:'error: ' + err });

				db.collection('songs').remove( { _id: ObjectId(songToDelete) }, function (err, result) {
					res.send((result === 1) ? { msg: '' } : { msg:'error: ' + err });
				});
			});

		});
	});

};