'use strict';

// General
var ObjectId = require('mongoskin').ObjectID;
var parseUrl = require('url');

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
		var images = [];

		lastfm.artist.getInfo({
			'artist' : query
		}, function (err, data) {
			if (err) console.log(err);

			if (data) {
				images.push(data.image[data.image.length - 1]['#text']); // Fetch the last one in array = the one with highest resolution
			}

			spotifyApi.searchArtists(query)
				.then(function(data) {
					return data.body.artists.items[0].id;
				})
				.then(function (data) {
					return spotifyApi.getArtist(data);
				})
				.then(function (data) {
					if (data) {
						images.push(data.body.images[0].url); // Fetch the first in array = the one with highest resolution
					}

					echojs('artist/images').get({
						name: query
					}, function (err, data) {
						var response = data.response.images;
						for (var i = 0, len = response.length; i < len; i++) {
							images.push(response[i].url);
						}

						res.json(images);
					});
				})
				.catch(function (error) {
					console.error(error);
				});
		});
	});

	router.get('/create-spotify-playlist/:title', function (req, res) {
		// Temp: Hardcoded code returned in the redirect URI
		var code = 'AQCHryS3eB5n86AF6as62hyFcxn6nU-UqPaYh38oZ0vAdM_yB-S2t_PG41UUNC3xvi9DtfSm8NdFKX3sksLWf8IMNIDrhpEJD2CrlR-o8HpCZFQ4Df-PoA2nLPntgmSfboDQGnk4-W1FR8zsNPL6mu_fMNCt5bX_z-28dGR6dRR5RXO2K-i1zwuEKEyoZeSRBjyAtfckDSqKtyI1ylElAjM6iw';
		var title = req.params.title;

		spotifyApi.authorizationCodeGrant(code)
			/*.then(function (data) {
				return data.body.tracks.map(function(t) { return t.id; });
			})*/
			.then(function (data) {
				console.log('The token expires in ' + data.body['expires_in']);
				console.log('The access token is ' + data.body['access_token']);
				console.log('The refresh token is ' + data.body['refresh_token']);

				// Set the access token on the API object to use it in later calls
				spotifyApi.setAccessToken(data.body['access_token']);
				spotifyApi.setRefreshToken(data.body['refresh_token']);
			})
			.then(function (data) {
				return spotifyApi.getMe();
			})
			.then(function (data) {
				return spotifyApi.createPlaylist(data.body.id, title, { 'public' : false });
			})
			.then(function (data) {
				var songs = [];

				var artist = 'Steely Dan';
				var title = 'My Old School';
				spotifyApi.searchTracks('artist:' + artist + ', title:' + title + '').then(function (song) {
					songs.push(song.body.tracks.items[0].uri);

					return spotifyApi.addTracksToPlaylist(data.body.owner.id, data.body.id, songs);
				});

			})
			.then(function (data) {
				console.log('Success', data);

			})
			.catch(function (error) {
				console.error(error);
			});
	});

};