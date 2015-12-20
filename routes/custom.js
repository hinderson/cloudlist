'use strict';

// General
var utils = require('../utils/utils');

// Spotify Web API
var spotifyCredentials = require('../config/private/spotify-api.js');
var SpotifyWebApi = require('spotify-web-api-node');
var spotifyApi = new SpotifyWebApi(spotifyCredentials);

// Database methods
var collections = require('../models/collections.js');

module.exports = function (router) {

	// TEMP: Redirect to 2015 Best Of playlist
	router.get('/', function (req, res) {
		res.redirect('/2015/');
	});

	// Best songs of 2015 (without user name)
	router.get('/2015', function (req, res, next) {
		collections.getOne({ 'permalink': '2015' }, function (result) {
			if (!result) return next();

			// Render template
			var template = result.collection.template;
			res.render('templates/' + template, {
				path: '2015',
				collection: result.collection,
				songs: result.songs
			});
		});
	});

	// Best songs of 2015 (without user name): Single song
	router.get('/2015/:permalink', function (req, res, next) {
		collections.getOne({ 'permalink': '2015' }, function (result) {
			if (!result) return next();

			// Render template
			var single = utils.findByKey(result.songs, 'permalink', req.params.permalink);
			var template = result.collection.template;
			res.render('templates/' + template, {
				path: '2015',
				collection: result.collection,
				songs: result.songs,
				single: single
			});
		});
	});

	router.get('/2014', function (req, res) {
		res.redirect('/best-songs-of-2014/');
	});

	// Best songs of 2014 (without user name)
	router.get('/best-songs-of-2014', function (req, res, next) {
		collections.getOne({ 'permalink': 'best-songs-of-2014' }, function (result) {
			if (!result) return next();

			// Render template
			var template = result.collection.template;
			res.render('templates/' + template, {
				path: 'best-songs-of-2014',
				collection: result.collection,
				songs: result.songs
			});
		});
	});

	// Best songs of 2014 (without user name): Single song
	router.get('/best-songs-of-2014/:permalink', function (req, res, next) {
		collections.getOne({ 'permalink': 'best-songs-of-2014' }, function (result) {
			if (!result) return next();

			// Render template
			var single = utils.findByKey(result.songs, 'permalink', req.params.permalink);
			var template = result.collection.template;
			res.render('templates/' + template, {
				path: 'best-songs-of-2014',
				collection: result.collection,
				songs: result.songs,
				single: single
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
