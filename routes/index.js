var express = require('express');
var path = require('path');
var router = express.Router();
var jsonpClient = require('jsonp-client');
var fs = require('fs');
var gm = require('gm');
var probe = require('node-ffprobe');
var async = require('async');
var shortId = require('shortid');
var ObjectId = require('mongoskin').ObjectID;

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
	var id = req.params.id || '7kgvszmD';

	// TEMP: Redirect to 2014 Best Of playlist
	res.redirect('/hinderson/best-songs-of-2014/');
	return;

	db.collection('collections').find({ 'slugs.id': id }).toArray(function (err, collection) {
		db.collection('songs').find().toArray(function (err, songs) {
			if (err) throw err;

			res.render('index', {
				title: 'Cloudlist.io',
				playlist: collection[0],
				songs: songs
			});
		});
	});
});

router.get('/hinderson/:playlist', function (req, res) {

	var db = req.db;
	var playlistTitle = req.params.playlist;

	// Find playlist based on permalink title
	db.collection('collections').find({ 'slugs.title': playlistTitle }).toArray(function (err, collection) {
		db.collection('songs').find().toArray(function (err, songs) {
			if (err) throw err;

			res.render('index', {
				title: 'Cloudlist.io',
				baseUrl: '/hinderson/' + playlistTitle,
				playlist: collection[0],
				songs: songs
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
							title: 'Cloudlist.io',
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

	db.collection('users').findOne({ _id: 1 }, function (err, user) {
		db.collection('collections').find().toArray(function (err, collections) {
			if (err) throw err;

			res.render('dashboard/dashboard', {
				title: 'Cloudlist.io',
				playlists : collections,
				sortorder: user.collections
			});
		});
	});
});

// GET Playlist page
router.get('/playlist/:id', auth.connect(basic), function (req, res) {

	var db = req.db;
	var collectionId = req.params.id;

	db.collection('collections').find({ 'slugs.id': collectionId }).toArray(function (err, collection) {
		db.collection('songs').find().toArray(function (err, songs) {
			if (err) throw err;

			res.render('dashboard/playlist', {
				title: 'Cloudlist.io',
				playlist: collection[0],
				songs: songs
			});
		});
	});
});

// GET Songcatalog API
router.get('/songcatalog/:id', function (req, res) {
	var db = req.db;
	var collectionId = req.params.id;

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

// POST to Add Collection Service
router.post('/addcollection', function (req, res) {

	var db = req.db;

	var title =  req.body.title || 'New playlist';

	db.collection('collections').insert({
		'created': new Date(),
		'covers': [],
		'description': '',
		'items': [],
		'owner': 1, // TEMP: Update once we have a user system
		'published': false,
		'slugs': {
			'id': shortId.generate(),
			'title': slugify(title)
		},
		'title': title
	}, function (err, doc) {
		if (err) {
			// If it failed, return error
			res.send("There was a problem adding the information to the database.");
		} else {
			console.log('Successfully added created collection');

			// Add new collection to user document
			var collectionId = doc[0]._id + '';
			console.log(collectionId);
			db.collection('users').update(
				{ _id: 1 },
				{ $push: { 'collections': collectionId }
			},
				function (err) {
					if (err) throw err;

					console.log('Successfully added collection to user account');

					// If it worked, set the header so the address bar doesn't still say /adduser
					res.location('dashboard');
					// And forward to success page
					res.redirect('dashboard');
				}
			)
		}
	});

});

// POST to Add User Service
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

/*
 * PUT to updatesong
 */
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

/*
 * PUT to reorderitems
 */
router.put('/orderitems', function (req, res) {
	var db = req.db;

	var collection = req.body.collection;
	var newOrder = req.body.changes;

	db.collection('collections').update({ _id: ObjectId(collection) }, {'$set': { items: newOrder }}, function (err, result) {
		if (err) throw err;

		res.send((result === 1) ? { msg: '' } : { msg:'error: ' + err });
	});
});

/*
 * DELETE to deletesong
 */
router.delete('/deletesong/', function (req, res) {
	var db = req.db;

	var songToDelete = req.body.songId;
	var collectionId = req.body.collectionId;

	console.log(songToDelete);
	console.log(collectionId);

	return;

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
	db.collection('songs').find({_id: ObjectId(songToDelete)}).toArray(function (err, song) {
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