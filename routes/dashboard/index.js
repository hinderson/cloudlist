// Auth stuff
var auth = require('http-auth');
var basic = auth.basic({
	realm: 'Cloudlist',
	file: './data/users.htpasswd'
});

module.exports = function (router) {

	// Dashboard home page
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

	// Single collection page
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

}