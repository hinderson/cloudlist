'use strict';

// General
var fs = require('fs');
var async = require('async');
var ObjectId = require('mongoskin').ObjectID;

// Database methods
var collections = require('../../methods/collections.js');
var songs = require('../../methods/songs.js');

module.exports = function (router) {

	// PUT existing song
	router.put('/updateitem/:id', function (req, res) {

	});

	// DELETE existing song
	router.delete('/deletesong/:id', function (req, res) {

	});

};