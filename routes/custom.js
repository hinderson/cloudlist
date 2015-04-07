'use strict';

module.exports = function (router) {

	// TEMP: Redirect to 2014 Best Of playlist
	router.get('/', function (req, res) {
		res.redirect('/best-songs-of-2014/');
	});

	// TEMP: Remove this
	router.get('/export-to-permalink', function (req, res) {
		var db = req.db;

		db.collection('songs').find().toArray(function (err, songs) {
			if (err) throw err;

			songs.forEach(function (song) {
				var permalink = song.slugs.artist + '-' + song.slugs.title;

				console.log(permalink);

				db.collection('songs').update( { 'slugs.title': song.slugs.title }, { '$set': { 'permalink': permalink } }, function (err) {
					if (err) throw err;

					console.log('Success?');
				});
			});
		});
	});

}