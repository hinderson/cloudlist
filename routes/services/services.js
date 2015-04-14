'use strict';

// General
var ObjectId = require('mongoskin').ObjectID;
var parseUrl = require('url');
var async = require('async');

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

			// Flattened multi-layered response array
			var images = [].concat.apply([], response);
			return res.json(images);
		});
	});

	router.get('/create-spotify-playlist/:title', function (req, res) {
		var title = req.params.title;
		var user =  'koeeoaddi'; // TODO: Cloudlist Spotify account

		spotifyApi.clientCredentialsGrant()
			.then(function (data) {
				return spotifyApi.setAccessToken(data.body['access_token']);
			})
			.then(function (data) {
				return spotifyApi.createPlaylist(user, title, { 'public' : false });
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