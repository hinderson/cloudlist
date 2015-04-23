'use strict';

// General
var ObjectId = require('mongoskin').ObjectID;
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
var collections = require('../../methods/collections.js');
var songs = require('../../methods/songs.js');
var users = require('../../methods/users.js');

module.exports = function (router) {

	// Return all songs in JSON format (based on sent cookie)
	router.get('/song-collection', function (req, res, next) {

		var collectionId = hashids.decodeHex(req.cookies.cl_collection);
		collections.getOne(collectionId, null, function (result) {
			if ('production' === process.env.NODE_ENV) {
				res.header('Cache-Control', 'max-age=' + 31556952000); // One year
			}

			// Make songs into hashmap
			var items = utils.generateHashmap(result.songs);

			res.json({
				collection: {
					id: result.collection._id,
					title: result.collection.title,
					owner: result.collection.owner
				},
				order: result.collection.items,
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
						var allResults = [];
						for (var i = 0, len = response.length; i < len; i++) {
							allResults.push(response[i].url);
						}
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
			response = response.filter(function (n) { return n !== null && n !== "" });

			// Flatten multi-layered response array
			var images = [].concat.apply([], response);

			return res.json(images);
		});
	});

	router.get('/spotify/create-playlist/:id', function (req, res) {

		// TEMP: Render the link in the Jade view instead

		var scopes = ['playlist-modify-private', 'playlist-modify-public'];
		var state = req.params.id; // This is a decoded id

		// Construct a Spotify authorization URL (could probably be made by hand)
		var authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);

		res.send(authorizeURL);
	});

	router.get('/spotify/callback', function (req, res) {

		var id = hashids.decodeHex(req.query.state) || null;
		var code = req.query.code || null;

		collections.getOne(id, null, function (result) {
			users.getOne(result.collection.owner, function (user) {

				var spotifySongs = [];
				var spotifyAccount = 'cloudlist.io';
				var playlistTitle = 'Cloudlist.io: ' + result.collection.title + ' by ' + user.name.first + ' ' + user.name.last;

				// Retrieve an access token and a refresh token
				spotifyApi.authorizationCodeGrant(code)
					.then(function (data) {
						console.log('The token expires in ' + data.body['expires_in']);
						console.log('The access token is ' + data.body['access_token']);
						console.log('The refresh token is ' + data.body['refresh_token']);

						// Set the access token on the API object to use it in later calls
						spotifyApi.setAccessToken(data.body['access_token']);
						spotifyApi.setRefreshToken(data.body['refresh_token']);
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

};