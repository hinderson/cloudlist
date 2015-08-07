'use strict';

// General
var async = require('async');
var utils = require('../../utils/utils');

// Hashid
var Hashids = require('hashids');
var secret = require('../../config/private/secret.js');
var hashids = new Hashids(secret);

// Spotify Web API
var spotifyCredentials = require('../../config/private/spotify-api.js');
var SpotifyWebApi = require('spotify-web-api-node');
var spotifyApi = new SpotifyWebApi(spotifyCredentials);

// Last.fm API
var lastFmCredentials = require('../../config/private/lastfm-api.js');
var LastfmAPI = require('lastfmapi');
var lastfm = new LastfmAPI(lastFmCredentials);

// Echonest API
var echonestCredentials = require('../../config/private/echonest-api.js');
var EchojsAPI = require('echojs');
var echojs = new EchojsAPI({
	key: echonestCredentials.api_key
});

// Database methods
var collections = require('../../models/collections.js');
var users = require('../../models/users.js');

module.exports = function (router) {

	// Return all songs in JSON format (based on sent cookie)
	router.get('/song-collection/:id', function (req, res, next) {
		if (!req.params.id) return;

		var collectionId = hashids.decodeHex(req.params.id);

		collections.getOne({ 'id': collectionId }, function (result) {
			if (!result) return false;

			if ('production' === process.env.NODE_ENV) {
				res.header('Cache-Control', 'max-age=' + 31556952000); // One year
			}

			// Structure songs (add encoded id and index placement)
			var order = result.collection.items.map(function (id, index) {
				var encodedID = hashids.encodeHex(id);
				var item = result.songs[index];

				item.index = index;
				item.id = encodedID;
				delete item._id;

				return encodedID;
			});

			// Make songs into hashmap
			var items = utils.makeHashmap(result.songs);

			res.json({
				collection: {
					id: hashids.encodeHex(result.collection._id),
					title: result.collection.title,
					owner: result.collection.owner
				},
				order: order,
				items: items
			});
		});
	});

	router.get('/fetch-artist-images', function (req, res) {
		var query = req.query.artist;

		async.parallel([
			function (callback) {
				lastfm.artist.getInfo({ 'artist' : query }, function (err, data) {
					if (err) console.error(err);

					callback(null, data ? data.image[data.image.length - 1]['#text'] : null);
				});
			},
			function (callback) {
				spotifyApi.searchArtists(query)
					.then(function (data) {
						return data.body.artists.items[0].id;
					})
					.then(function (data) {
						return spotifyApi.getArtist(data);
					})
					.then(function (data) {
						callback(null, data.body.images[0].url);
					})
					.catch(function (err) {
						if (err) console.error(err);

						callback(null, null);
					});
			},
			function (callback) {
				echojs('artist/images').get({ 'name': query }, function (err, data) {
					if (err) console.error(err);

					var response = data.response.images;
					if (response) {
						var allResults = response.map(function (item) {
							return item.url;
						});
						callback(null, allResults);
					} else {
						callback(null, null);
					}
				});
			}
		], function (err, response) {
			if (err) console.log(err);

			console.log('Image search complete', response);

			// Remove null responses from array
			response = response.filter(function (n) { return n !== null && n !== ''; });

			// Flatten multi-layered response array
			var images = [].concat.apply([], response);

			return res.json(images);
		});
	});

	router.get('/spotify/callback', function (req, res) {

		var id = hashids.decodeHex(req.query.state) || null;
		var code = req.query.code || null;

		collections.getOne({ 'id': id }, function (result) {
			users.getOne({ 'id': result.collection.owner }, function (user) {

				var spotifySongs = [];
				var spotifyAccount = 'cloudlist.io';
				var playlistTitle = 'Cloudlist.io: ' + result.collection.title + ' by ' + user.name.first + ' ' + user.name.last;

				// Retrieve an access token and a refresh token
				spotifyApi.authorizationCodeGrant(code)
					.then(function (data) {
						console.log('The token expires in ' + data.body.expires_in);
						console.log('The access token is ' + data.body.access_token);
						console.log('The refresh token is ' + data.body.refresh_token);

						// Set the access token on the API object to use it in later calls
						spotifyApi.setAccessToken(data.body.access_token);
						spotifyApi.setRefreshToken(data.body.refresh_token);
					})
					.then(function (data) {

						var songs = result.songs;
						async.eachSeries(songs, function (song, callback) {

							spotifyApi.searchTracks('artist:' + song.artist + ', title:' + song.title + '')
								.then(function (data) {
									if (data.body.tracks.items.length) {
										spotifySongs.push(data.body.tracks.items[0].uri);
									}
									callback();
								})
								.catch(function (err) {
									console.error('Song couldn\'t be found', err);
									callback();
								});

						}, function (err) {
							spotifyApi.createPlaylist(spotifyAccount, playlistTitle, { 'public' : true })
								.then(function (data) {
									spotifyApi.addTracksToPlaylist(spotifyAccount, data.body.id, spotifySongs);

									var publicPlaylistUrl = data.body.external_urls.spotify;
									res.redirect(publicPlaylistUrl);
								})
								.catch(function (err) {
									console.error(err);
								});
						});
					})
					.catch(function (err) {
						console.error(err);
					});
			});
		});

	});


	// TEMP: Not used
	router.get('/create-covers-montage/:id', function (req, res) {
		collections.createCoversMontage(req.params.id);
	});

};
