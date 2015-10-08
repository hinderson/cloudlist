'use strict';

// Requires
var utils = require('./utils.js');
var config = require('./config.js');
var pubsub = require('./pubsub.js');
var collection = require('./data/collection.js');

// WebAudio basics
var context = new (window.AudioContext || window.webkitAudioContext)(); // jshint ignore:line
var audioElement;
var gainNode;

// Settings
var settings = {
	volume: (utils.isLocalStorageAllowed() ? window.localStorage.volume : 9.0) || 9.0, // Default value is always 90
	key: config.settings.soundCloudKey,
	path: config.settings.cdn + '/audio/'
};

// State
var currentState = 'idle';
var currentId;

var getState = function ( ) {
	return currentState;
};

var setState = function (state) {
	currentState = state;
};

var setVolume = function (volume) {
	if (currentId) {
		gainNode.gain.value = volume;
	}
	window.localStorage.volume = volume;
	settings.volume = volume;
};

var getVolume = function ( ) {
	return settings.volume;
};

var toggleState = function (id) {
	if (id && id !== currentId) {
		play(id);
	} else if (getState() === 'paused') {
		resume(currentId);
	} else if (currentId) {
		pause(currentId);
	} else {
		play(collection.getFirstItem());
	}
};

var destroy = function (id) {
	// source.mediaElement.src = '';
};

var play = function (id) {
	// First stop the currently playing sound, if any
	if (currentId) {
		stop(currentId);
	}
	currentId = id;

	var song = collection.getCollection()[id];
	var url = song.audio.source === 'soundcloud' ? song.audio.stream + '?consumer_key=' + settings.key : settings.path + song.audio.url;

	setState('loading');
	pubsub.publish('audioLoading', id);

	audioElement = new Audio();
	audioElement.crossOrigin = 'anonymous';
	gainNode = context.createGain();
	var source = context.createMediaElementSource(audioElement);

	source.connect(gainNode);
	gainNode.connect(context.destination);

	// Set initial volume
	gainNode.gain.value = settings.volume;

	// Load URL
	audioElement.src = url;

	audioElement.addEventListener('loadedmetadata', function ( ) {
		audioElement.currentTime = Math.max((song.audio.starttime / 1000), 0);
	});

	audioElement.addEventListener('canplay', function ( ) {
		setState('playing');
		pubsub.publish('audioPlaying', id);
		audioElement.play();
	});

	audioElement.addEventListener('ended', function ( ) {
		stop();
		next(); // TODO: Fix direction
	});

	audioElement.addEventListener('timeupdate', function (e) {
		var duration = audioElement.duration;
		var position = audioElement.currentTime - Math.max((song.audio.starttime / 1000), 0);
		var percent = position / duration * 100;

		pubsub.publish('audioUpdating', [ position, percent ]);
	});

	audioElement.addEventListener('error', function (e) {
		console.log(url, 'has failed loading', e);
		pubsub.publish('audioFailedLoading', id);
		next(); // TODO: Fix direction
	});
};

var pause = function (id) {
	if (!id) { id = currentId; }
	setState('paused');
	pubsub.publish('audioPaused', id);
	audioElement.pause();
};

var resume = function (id) {
	setState('playing');
	pubsub.publish('audioResumed', id);
	audioElement.play();
};

var next = function () {
	if (!currentId) { return false; }
	play(collection.getNextItem(currentId).id);
};

var previous = function (acc) {
	if (!currentId) { return false; }
	play(collection.getPreviousItem(currentId).id);
};

var stop = function (id) {
	id = id || currentId;
	currentId = '';
	audioElement.pause();
	audioElement.currentTime = 0;
	setState('stopped');
	pubsub.publish('audioStopped', id);

	destroy(id);
};

var stopAll = function ( ) {
	var items = collection.getCollectionOrder();
	items.forEach(stop);
};

// Export interface
module.exports = {
	getState: getState,
	setVolume: setVolume,
	getVolume: getVolume,
	toggleState: toggleState,
	play: play,
	pause: pause,
	resume: resume,
	next: next,
	previous: previous,
	stop: stop,
	stopAll: stopAll
};
