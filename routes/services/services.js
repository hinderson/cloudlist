'use strict';

// General
var ObjectId = require('mongoskin').ObjectID;
var parseUrl = require('url');
var async = require('async');

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

	// Return all songs in JSON format
	router.get('/song-collection', function (req, res) {
		// TEMP: Trying out url module (maybe put it in a module?)
		var collection = parseUrl.parse(req.headers.referer).pathname.split('/').filter(function (e) { return e })[0];

		collections.getOne(null, collection, function (result) {
			if ('production' === process.env.NODE_ENV) {
				res.header('Cache-Control', 'max-age=' + 31556952000); // One year
			}

			res.json({
				order: result.collection.items,
				items: result.songs
			});
		});
	});

	router.get('/fetch-artist-images', function (req, res) {
		var query = req.query.artist;

		async.parallel([
			function (callback) {
				lastfm.artist.getInfo({ 'artist' : query }, function (err, data) {
					callback(err, data.image[data.image.length - 1]['#text']);
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
					.catch(function (error) {
						console.error(error);
					});
			},
			function (callback) {
				echojs('artist/images').get({ 'name': query }, function (err, data) {
					var response = data.response.images;
					var allResults = [];
					for (var i = 0, len = response.length; i < len; i++) {
						allResults.push(response[i].url);
					}
					callback(err, allResults);
				});
			}
		], function (err, response) {
			if (err) console.log(err);

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

		// Taken from the "state" query that's sent into Spotify's authentication process
		var id = hashids.decodeHex(req.query.state) || null;

		var code = req.query.code || null;

		collections.getOne(id, null, function (result) {
			var songs = result.songs;

			var user = 'koeeoaddi';
			var title = 'Cloudlist.io: ' + result.title + ' by Mattias Hinderson';
			//console.log('User', result.owner, users.getOne(result.owner));

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
				.then(function ( ) {
					return spotifyApi.createPlaylist(user, title, { 'public' : false });
				})
				.then(function (data) {
					var spotifySongs = [];

					async.each(songs, function (song, callback) {
						var artist = song.artist;
						var title = song.title;

						spotifyApi.searchTracks('artist:' + artist + ', title:' + title + '')
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
						if (!err) {
							spotifyApi.addTracksToPlaylist(user, data.body.id, spotifySongs);

							var publicPlaylistUrl = data.body.external_urls.spotify;
							res.redirect(publicPlaylistUrl);
						}
					});
				})
				.catch(function (err) {
					console.error(err);
				});
		});

	});

};