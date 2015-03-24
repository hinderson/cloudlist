// General
var ObjectId = require('mongoskin').ObjectID;

module.exports = function (router) {

	// Render home page
	router.get('/', function (req, res) {
		// TEMP: Redirect to 2014 Best Of playlist
		res.redirect('/best-songs-of-2014/');

		return;

		/*
		var db = req.db;
		var id = req.params.id || '7kgvszmD';

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
		*/
	});

	// Frontend: Single collection
	router.get('/:collection', function (req, res) {
		var db = req.db;
		var collectionSlug = req.params.collection;

		// Find playlist based on permalink title
		db.collection('collections').find( { 'slugs.title': collectionSlug } ).toArray(function (err, collection) {
			db.collection('songs').find( ).toArray(function (err, songs) {
				if (err) throw err;

				res.locals.data = collection[0]._id;

				res.render('index', {
					title: 'Cloudlist.io',
					baseUrl: collectionSlug,
					playlist: collection[0],
					songs: songs
				});
			});
		});
	});

	// Frontend: Single song
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

	// Dashboard: Reorder items
	router.put('/orderitems', function (req, res) {
		var db = req.db;

		var collection = req.body.collection;
		var newOrder = req.body.changes;

		db.collection('collections').update({ _id: ObjectId(collection) }, {'$set': { items: newOrder }}, function (err, result) {
			if (err) throw err;

			res.send((result === 1) ? { msg: '' } : { msg:'error: ' + err });
		});
	});

}