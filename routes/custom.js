'use strict';

// Hashid
var Hashids = require('hashids');
var secret = require('../config/private/secret.js');
var hashids = new Hashids(secret);

// Spotify Web API
var spotifyCredentials = require('../config/private/spotify-api.js');
var SpotifyWebApi = require('spotify-web-api-node');
var spotifyApi = new SpotifyWebApi(spotifyCredentials);

// Database methods
var collections = require('../models/collections.js');

module.exports = function (router) {

	// TEMP: Redirect to 2014 Best Of playlist
	router.get('/', function (req, res) {
		res.redirect('/best-songs-of-2014/');
	});

	// Best songs of 2014 (without user name)
	router.get('/best-songs-of-2014', function (req, res, next) {
		collections.getOne(null, 'best-songs-of-2014', function (result) {
			if (!result) return next();

			// Set view state cookie
			var collectionId = hashids.encodeHex(result.collection._id);
			res.cookie('cl_collection', collectionId, { maxAge: 900000 });

			// Render template
			var template = result.collection.template;
			res.render('templates/' + template, {
				path: 'best-songs-of-2014',
				collection: result.collection,
				songs: result.songs
			});
		});
	});

	// TEMP: Authenticate spotify user
	router.get('/authenticate-spotify-user', function (req, res) {
		var scopes = ['playlist-modify-private'];
		var state = 'this-is-probably-our-playlist-permalink';
		var authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
		res.send(authorizeURL);
	});

};
