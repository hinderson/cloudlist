'use strict';

// General
var request = require('request');
var async = require('async');
var utils = require('../../utils/utils');
var url = require('url');
var json2csv = require('json2csv');
var crypto = require('crypto');

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

	// Return all songs in JSON format
	router.get('/api/v1/collection', function (req, res, next) {
		function returnJSON (result) {
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
		}

		// Resolve query
		if (req.query.id) {
			collections.getOne({ 'id': hashids.decodeHex(req.query.id) }, returnJSON);
		} else {
			var paths = url.parse(req.headers.referer).pathname.split('/').slice(1, -1);
			var collectionFound;
			paths.forEach(function (path) {
				if (collectionFound) { return; }

				collections.getOne({ 'permalink': path }, function (result) {
					if (result) { returnJSON(result); collectionFound = true; }
				});
			});
		}
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
		var accessToken;

		collections.getOne({ 'id': id }, function (result) {
			users.getOne({ 'id': result.collection.owner }, function (user) {

				var spotifySongs = [];
				var playlistTitle = 'Cloudlist.io: ' + result.collection.title + ' by ' + user.name.first + ' ' + user.name.last;

				// Retrieve an access token and a refresh token
				spotifyApi.authorizationCodeGrant(code)
					.then(function (data) {
						console.log('The token expires in ' + data.body.expires_in);
						console.log('The access token is ' + data.body.access_token);
						console.log('The refresh token is ' + data.body.refresh_token);

						accessToken = data.body.access_token;

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
							spotifyApi.getMe().then(function (data) {
								var spotifyAccount = data.body.id;

								spotifyApi.createPlaylist(spotifyAccount, playlistTitle, { 'public' : true })
									.then(function (data) {
										function makeRequest (songs, callback) {
											request.post({
												headers: {
													'Authorization': 'Bearer ' + accessToken,
													'Content-Type': 'application/json'
												},
												url: 'https://api.spotify.com/v1/users/koeeoaddi/playlists/' + data.body.id + '/tracks?uris=' + encodeURIComponent(songs.join(',')),
											}, function (error, response) {
												if (callback && typeof(callback) === 'function') {
													callback();
												}
												console.log(response.statusMessage);
											});
										}

										// Split request into two to avoid "URI Too Long" error
										makeRequest(spotifySongs.slice(0, spotifySongs.length / 2), function ( ) {
											makeRequest(spotifySongs.slice(spotifySongs.length / 2, spotifySongs.length), function ( ) {
												// Redirect to playlist
												res.redirect(data.body.external_urls.spotify);
											});
										});
									})
									.catch(function (err) {
										console.error('Couldn\'t create playlist ', err);
									});
							});
						});
					})
					.catch(function (err) {
						console.error(err);
					});
			});
		});

	});

	router.get('/create-covers-montage/:id', function (req, res) {
		collections.createCoversMontage(req.params.id);
	});

	router.get('/download-as-csv', function (req, res) {
		var id = hashids.decodeHex(req.query.id);
		var fields = ['artist', 'featuredartist', 'title', 'album'];
		var fieldNames = ['Artist Name', 'Featured Artist', 'Track Name', 'Album Name'];

		collections.getOne({ 'id': id }, function (data) {
			json2csv({ data: data.songs, fields: fields, fieldNames: fieldNames }, function (err, csv) {
				if (err) throw err;

				res.setHeader('Content-disposition', 'attachment; filename=' + crypto.randomBytes(16).toString('hex') + '.csv');
				res.setHeader('Content-type', 'text/plain');
				res.charset = 'UTF-8';
				res.write(csv);
				res.end();
			});
		});
	});

};
