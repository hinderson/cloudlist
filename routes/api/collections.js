var slugify = require('../../utils/slugify.js');
var shortId = require('shortid');

module.exports = function (router) {

	// POST new collection
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

};