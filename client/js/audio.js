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
	muted: false,
	key: config.settings.soundCloudKey,
	path: config.settings.cdn + '/audio/'
};

// State
var currentState = 'idle';
var currentId = '';

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

var toggleMute = function ( ) {
	if (settings.muted) {
		gainNode.gain.value = settings.volume;
		currentId = false;
		pubsub.publish('audioUnmuted', settings.volume);
	} else {
		gainNode.gain.value = 0;
		currentId = true;
		pubsub.publish('audioMuted');
	}
};

var toggleState = function (id) {
	console.log('Toggle state', id, getState());
	if (id && id !== currentId) {
		play(id);
	} else if (getState() === 'paused') {
		console.log('trying to resume');
		resume(currentId);
	} else if (currentId) {
		pause(currentId);
	} else {
		id = collection.getCollectionOrder()[0];
		play(id);
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

	pubsub.publish('audioLoading', id);

	audioElement = new Audio();
	audioElement.crossOrigin = 'anonymous';
	gainNode = context.createGain();
	var source = context.createMediaElementSource(audioElement);

	source.connect(gainNode);
	gainNode.connect(context.destination);

	// Set initial volume
	if (settings.muted) {
		gainNode.gain.value = 0;
	} else {
		gainNode.gain.value = settings.volume;
	}

	// Load URL
	audioElement.src = url;

	audioElement.addEventListener('loadedmetadata', function ( ) {
		audioElement.currentTime = Math.max((song.audio.starttime / 1000), 0);
	});

	audioElement.addEventListener('canplay', function ( ) {
		audioElement.play();
	});

	audioElement.addEventListener('playing', function ( ) {
		if (getState() === 'idle' || getState() === 'stopped') {
			pubsub.publish('audioPlaying', id);
		}
	});

	audioElement.addEventListener('ended', function ( ) {
		stop();
		next();
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
		next();
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

var next = function ( ) {
	var currentPosition = collection.getItemPosition(currentId);
	var id = collection.getNextItem(currentPosition);

	var song = collection.getItem(id);
	if (!song.available) {
		id = collection.getNextItem(currentPosition++);
	}

	play(id);
};

var previous = function ( ) {
	var currentPosition = collection.getItemPosition(currentId);
	var id = collection.getPreviousItem(currentPosition);

	var song = collection.getItem(id);
	if (!song.available) {
		id = collection.getPreviousItem(currentPosition--);
	}

	play(id);
};

var stop = function (id) {
	id = id || currentId;
	audioElement.pause();
	audioElement.currentTime = 0;
	currentId = '';
	setState('stopped');
	pubsub.publish('audioStopped', id);

	destroy(id);
};

var stopAll = function ( ) {
	var items = collection.getCollectionOrder();
	for (var i = 0, len = items.length; i < len; i++) {
		stop(items[i]);
	}
};

// Export interface
module.exports = {
	getState: getState,
	setVolume: setVolume,
	getVolume: getVolume,
	toggleMute: toggleMute,
	toggleState: toggleState,
	play: play,
	pause: pause,
	resume: resume,
	next: next,
	previous: previous,
	stop: stop,
	stopAll: stopAll
};
