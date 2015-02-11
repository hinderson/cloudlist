var express = require('express');
var path = require('path');
var router = express.Router();
var jsonpClient = require('jsonp-client');
var fs = require('fs');
var gm = require('gm');
var probe = require('node-ffprobe');
var async = require('async');

// ffmpeg
var ffmpeg = require('fluent-ffmpeg');

// Auth stuff
var auth = require('http-auth');
var basic = auth.basic({
	realm: 'Cloudlist',
	file: path.join(__dirname, '/..', 'data/users.htpasswd')
});

function slugify (text) {
	return text.toString().toLowerCase()
		.replace(/\s+/g, '-') // Replace spaces with -
		.replace(/[^\w\-]+/g, '') // Remove all non-word chars
		.replace(/\-\-+/g, '-') // Replace multiple - with single -
		.replace(/^-+/, '') // Trim - from start of text
		.replace(/-+$/, ''); // Trim - from end of text
}

// GET home page
router.get('/', function (req, res) {
	var db = req.db;

	db.collection('songs').find().toArray(function (err, songs) {
		db.collection('collections').find().toArray(function (err, order) {
			res.render('index', {
				path: req.path,
				title: 'Cloudlist',
				collectionTitle: order[0] && order[0].title || null,
				songlist: songs,
				sortorder: order[0] && order[0].items || null // TEMP: Update to correct collection name
			});
		});
	});
});

// GET individual song page based on slug
router.get('/artist/:artistslug/track/:trackslug', function (req, res) {
	var db = req.db;

	db.collection('songs').find().toArray(function (err, songs) {
		db.collection('collections').find().toArray(function (err, order) {
			db.collection('songs').findOne({
				'slugs.artist': req.params.artistslug,
				'slugs.title': req.params.trackslug}, function (err, song) {
					if (err) throw err;
					if (song) {

						var artist = Array.isArray(song.artist) && song.artist.length > 1 ? song.artist.slice(0, -1).join(', ') + ' & ' + song.artist[song.artist.length -1] : song.artist;
						var featuredartist = Array.isArray(song.featuredartist) && song.featuredartist.length > 1 ? song.featuredartist.slice(0, -1).join(', ') + ' & ' + song.featuredartist[song.featuredartist.length -1] : song.featuredartist;
						featuredartist = featuredartist && featuredartist.length > 0 ? (' feat. ' + featuredartist) : '';

						// Find index of song
						var id = song._id.toString();
						var index = order[0].items.indexOf(id) + 1;

						res.render('index', {
							// TODO: cdn:
							path: req.path,
							title: 'Cloudlist',
							collectionTitle: order[0] && order[0].title || null,
							songlist: songs,
							sortorder: order[0] && order[0].items || null, // TEMP: Update to correct collection name
							autostart: song._id,
							songIndex: index,
							songCover: song.covers[0].screenshot ? song.covers[0].screenshot : song.covers[0].src,
							songTitle: song.title,
							songArtist: artist + featuredartist
						});
					} else {
						res.status(400);
						res.render('404.jade', { title: '404: Page Not Found' });
					}
			});
		});
	});
});

// GET Dashboard page
router.get('/dashboard', auth.connect(basic), function (req, res) {
	var db = req.db;
	db.collection('songs').find().toArray(function (err, songs) {
		db.collection('collections').find().toArray(function (err, order) {
			res.render('dashboard', {
				title: 'Dashboard | Cloudlist.io',
				'songlist' : songs,
				'sortorder': order[0].items // TEMP: Update to correct collection name
			});
		});
	});
});

// GET Songcatalog API
router.get('/songcatalog/:id', function (req, res) {
	var db = req.db;

	var env = process.env.NODE_ENV;
	if ('production' === env) {
		var oneYear = 31556952000;
		res.header('Cache-Control', 'max-age=' + oneYear);
	}

	db.collection('songs').find().toArray(function (err, items) {
		db.collection('collections').find().toArray(function (err, order) {
			res.json({
				'order': order[0] && order[0].items || null,
				'items': items
			});
		});
	});
});

// POST to Add User Service
router.post('/addsong', function (req, res) {

	var db = req.db;

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

		for (var i in result) {
			console.log(result[i]);
		}

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

					// Add newly added song to the collection doc
					var songID = doc[0]._id + '';
					db.collection('collections').findOne({ title: "Best Songs of 2014" }, function (err, items) {
						if (err) throw err;

						var sortOrder = [];
						sortOrder = items.items;
						sortOrder.push(songID);

						db.collection('collections').update(
							{ title: "Best Songs of 2014" },
							{
								title: "Best Songs of 2014",
								items: sortOrder
							},
							{ upsert: true }, function (err, doc) {
								if (err) throw err;

								// If it worked, set the header so the address bar doesn't still say /adduser
								res.location('dashboard');
								// And forward to success page
								res.redirect('dashboard');
							}
						);
					});
				}
			});
		});

	});

});

/*
 * PUT to updatesong
 */
router.put('/updateitem/', function (req, res) {
	ObjectID = require('mongoskin').ObjectID;
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

	db.collection('songs').update({_id: new ObjectID(id)}, {'$set': query}, function (err, result) {
		if (err) throw err;

		res.send((result === 1) ? { msg: '' } : { msg:'error: ' + err });
	});
});

/*
 * PUT to reorderitems
 */
router.put('/orderitems/', function (req, res) {
	ObjectID = require('mongoskin').ObjectID;
	var db = req.db;
	var newOrder = req.body.changes;

	db.collection('collections').update({ title: 'Best Songs of 2014' }, {'$set': { items: newOrder }}, function (err, result) {
		if (err) throw err;

		console.log('New item order:', newOrder);

		res.send((result === 1) ? { msg: '' } : { msg:'error: ' + err });
	});
});

/*
 * DELETE to deletesong
 */
router.delete('/deletesong/:id', function (req, res) {
	ObjectID = require('mongoskin').ObjectID;
	var db = req.db;
	var songToDelete = req.params.id;

	function deleteAssociatedFiles (song) {

		if (song[0].covers) {
			var source = song[0].covers[0].src;
			var ext = path.extname(source).slice(1);
			console.log(ext + 'to delete');
			fs.unlink('./public/media/' +  (ext === 'mp4' ? 'video/' : 'img/') + song[0].covers[0].src);
		}

		if (song[0].audio && song[0].audio.url && song[0].audio.source !== 'soundcloud') {
			fs.unlink('./public/media/audio/' + song[0].audio.url);
		}
	}

	// Remove song from songs
	db.collection('songs').find({_id: new ObjectID(songToDelete)}).toArray(function (err, song) {
		if (err) throw err;

		deleteAssociatedFiles(song);

		// Remove song from collection
		db.collection('collections').update({ title: 'Best Songs of 2014' }, { $pull: { items: songToDelete } }, function (err, result) {
			res.send((result === 1) ? { msg: '' } : { msg:'error: ' + err });

			db.collection('songs').removeById(songToDelete, function (err, result) {
				res.send((result === 1) ? { msg: '' } : { msg:'error: ' + err });
			});
		});

	});
});

module.exports = router;