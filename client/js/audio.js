'use strict';

// Requires
var utils = require('./utils.js');
var config = require('./config.js');
var pubsub = require('./pubsub.js');
var collection = require('./data/collection.js');

// Settings
var settings = {
	key: config.settings.soundCloudKey,
	path: config.settings.cdn + '/audio/',
	volume: (utils.isLocalStorageAllowed() ? window.localStorage.volume : 0.9) || 0.9,
	repeat: (utils.isLocalStorageAllowed() ? window.localStorage.volume : true) || true,
	shuffle: (utils.isLocalStorageAllowed() ? window.localStorage.volume : false) || false,
	direction: 'forwards'
};

// State
var currentState = 'idle';
var currentId;
var currentPausedTime;

// WebAudio basics
var audioElement = new Audio();
audioElement.autoplay = true;

var getState = function ( ) {
	return currentState;
};

var getCurrentId = function ( ) {
	return currentId;
};

var setState = function (state) {
	currentState = state;
};

var setVolume = function (volume) {
	if (currentId) {
		audioElement.volume = volume;
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
		play(collection.getFirstItem().id);
	}
};

var play = function (id, time) {
	// First stop the currently playing sound, if any
	if (currentId) { stop(currentId); }
	currentId = id;

	var song = collection.getItem(id);
	var url = song.audio.source === 'soundcloud' ? song.audio.stream + '?consumer_key=' + settings.key : settings.path + song.audio.url;

	setState('loading');
	pubsub.publish('audioLoading', id);

	// Set initial volume
	audioElement.volume = settings.volume;

	// Load URL
	audioElement.src = url;
	audioElement.load();

	function removeEventListeners ( ) {
		audioElement.removeEventListener('loadedmetadata', events.onLoad);
		audioElement.removeEventListener('canplay', events.onPlay);
		audioElement.removeEventListener('ended', events.onEnd);
		audioElement.removeEventListener('stopped', events.onStop);
		audioElement.removeEventListener('timeupdate', events.whilePlaying);
		audioElement.removeEventListener('error', events.onError);
	}

	var events = {
		onLoad: function ( ) {
			audioElement.currentTime = time || Math.max((song.audio.starttime / 1000), 0);
		},
		onPlay: function ( ) {
			console.log('PLAYING EVENT', currentState);
			if (currentState === 'playing') { return; } // Sometimes a canPlay event is sent twice
			setState('playing');
			pubsub.publish('audioPlaying', id);
			time && pubsub.publish('forceCollectionRepaint'); // Force a repaint if custom starttime is given
			currentPausedTime = 0;
			audioElement.play();

			/* jshint ignore:start */
			ga('send', {
				hitType: 'event',
				eventCategory: 'Tracks',
				eventAction: 'play',
				eventLabel: song.title
			});
			/* jshint ignore:end */
		},
		onEnd: function ( ) {
			console.log('ENDED', id);
			stop(id);
			next();
		},
		onStop: function ( ) {
			removeEventListeners();
			audioElement.src = '';
			audioElement.load();
		},
		onError: function (e) {
			function fail ( ) {
				removeEventListeners();
				pubsub.publish('audioFailedLoading', id);
				if (settings.direction === 'forwards') {
					next();
				} else {
					previous();
				}
			}

			switch (e.target.error.code) {
				case e.target.error.MEDIA_ERR_ABORTED:
					console.log('You aborted the video playback.', url);
					fail();
					break;
				case e.target.error.MEDIA_ERR_NETWORK:
					console.log('A network error caused the audio download to fail.', url);
					if (currentPausedTime > 2) {
						play(id, currentPausedTime);
					} else {
						fail();
					}
					break;
				case e.target.error.MEDIA_ERR_DECODE:
					console.log('The audio playback was aborted due to a corruption problem or because the video used features your browser did not support.', url);
					fail();
					break;
				case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
					console.log('The audio could not be loaded, either because the server or network failed or because the format is not supported.', url);
					fail();
					break;
				default:
					console.log('An unknown error occurred.', url);
					fail();
					break;
			}
		},
		whilePlaying: function ( ) {
			if (currentState !== 'playing') { return; }

			var duration = audioElement.duration;
			var position = audioElement.currentTime - Math.max((song.audio.starttime / 1000), 0);
			var percent = position / duration * 100;

			pubsub.publish('audioUpdating', [ position, percent ]);
		},
	};

	audioElement.addEventListener('loadedmetadata', events.onLoad, false);
	audioElement.addEventListener('canplay', events.onPlay, false);
	audioElement.addEventListener('ended', events.onEnd, false);
	audioElement.addEventListener('stopped', events.onStop, false);
	audioElement.addEventListener('timeupdate', events.whilePlaying, false);
	audioElement.addEventListener('error', events.onError, false);
};

var pause = function (id) {
	if (!id) { id = currentId; }
	setState('paused');
	pubsub.publish('audioPaused', id);
	currentPausedTime = audioElement.currentTime;
	audioElement.pause();
};

var resume = function (id) {
	console.log('Resuming', id);
	setState('playing');
	pubsub.publish('audioResumed', id);
	audioElement.play();
};

var next = function () {
	if (!currentId) { return false; }
	settings.direction = 'forwards';
	play(collection.getNextItem(currentId).id);
};

var previous = function (acc) {
	if (!currentId) { return false; }
	settings.direction = 'backwards';
	play(collection.getPreviousItem(currentId).id);
};

var stop = function (id) {
	if (!id) { id = currentId; currentId = null; }
	setState('stopped');
	pubsub.publish('audioStopped', id);
	if (audioElement) {
		audioElement.pause();
		utils.simulateEvent(audioElement, 'stopped');
	}
};

var stopAll = function ( ) {
	var items = collection.getCollectionOrder();
	items.forEach(stop);
};

// Export interface
module.exports = {
	getState: getState,
	getCurrentId: getCurrentId,
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
