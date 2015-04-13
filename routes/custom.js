'use strict';

// Spotify Web API
var spotifyCredentials = require('../config/private/spotify-api.js');
var SpotifyWebApi = require('spotify-web-api-node');
var spotifyApi = new SpotifyWebApi(spotifyCredentials);

module.exports = function (router) {

	// TEMP: Redirect to 2014 Best Of playlist
	router.get('/', function (req, res) {
		res.redirect('/best-songs-of-2014/');
	});

	// TEMP: Authenticate spotify user
	router.get('/authenticate-spotify-user', function (req, res) {
		var scopes = ['playlist-modify-private'];
		var state = 'this-is-probably-our-playlist-permalink';
		var authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
		res.send(authorizeURL);
	});

};