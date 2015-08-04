'use strict';

// Requires
var soundManager = require('./vendor/soundmanager2-nodebug-jsmin.js').soundManager;
var utils = require('./utils.js');
var config = require('./config.js');
var pubsub = require('./pubsub.js');
var collection = require('./data/collection.js');

// Settings
var s = {
	volume: (utils.isLocalStorageAllowed() ? window.localStorage.volume : 90) || 90, // Default value is always 90
	key: config.settings.soundCloudKey,
	path: config.settings.cdn + '/audio/'
};

// State
var state = {
	audio: 'idle',
	muted: false,
	currentId: ''
};

var getState = function ( ) {
	return state;
};

var setVolume = function (volume) {
	state.currentId && soundManager.getSoundById(state.currentId).setVolume(volume);
	window.localStorage.volume = volume;
	s.volume = volume;
};

var getVolume = function ( ) {
	return s.volume;
};

var toggleMute = function ( ) {
	if (state.muted) {
		soundManager.unmute(state.currentId);
		state.muted = false;

		// Restore volume slider to previous state
		pubsub.publish('audioUnmuted', s.volume);
	} else {
		soundManager.mute(state.currentId);
		state.muted = true;

		// Set volume slider to 0
		pubsub.publish('audioMuted');
	}
};

var toggleState = function (id) {
	if (id && id !== state.currentId) {
		play(id);
	} else if (state.audio === 'paused') {
		resume(state.currentId);
	} else if (state.currentId) {
		pause(state.currentId);
	} else {
		id = collection.getCollectionOrder()[0];
		play(id);
	}
};

var destroy = function (id) {
	soundManager.destroySound(id);
};

var play = function (id) {
	// First stop the currently playing sound, if any
	if (state.currentId) {
		stop(state.currentId);
	}
	state.currentId = id;

	var song = collection.getCollection()[id];
	var url = song.audio.source === 'soundcloud' ? song.audio.stream + '?consumer_key=' + s.key : s.path + song.audio.url;

	pubsub.publish('audioLoading', id);

	// Create sound
	var sound = soundManager.createSound({
		id: id,
		volume: s.volume,
		multiShot: false,
		autoPlay: false,
		url: url,
		stream: false,
		useFlashBlock : true,
		onload: function (success) {
			if (!success) {
				console.log(url, 'has failed loading');

				pubsub.publish('audioFailedLoading', id);

				// TODO: Send message to server saying the track is not available anymore
				next();
			}
		},
		onplay: function ( ) {
			console.log('Playing stream', url);

			state.audio = 'playing';
			pubsub.publish('audioPlaying', id);
		},
		onpause: function ( ) {
			pubsub.publish('audioPaused', id);
		},
		onresume: function ( ) {
			pubsub.publish('audioResumed', id);
		},
		onstop: function ( ) {
			state.audio = 'stopped';
			pubsub.publish('audioStopped', id);

			destroy(id);
		},
		onfinish: function ( ) {
			state.audio = 'stopped';
			pubsub.publish('audioStopped', id);

			destroy(id);
			next();
		},
		whileplaying: function ( ) {
			var duration = this.duration;
			var position = this.position - song.audio.starttime;
			var percent = position / duration * 100;

			pubsub.publish('audioUpdating', [ position, percent ]);
		}
	});

	// Play sound
	sound.setPosition(song.audio.starttime); // Set custom starttime
	sound.play();

	if (state.muted) {
		sound.mute();
	}
};

var pause = function (id) {
	if (!id) {
		id = state.currentId;
	}
	soundManager.pause(id);
	state.audio = 'paused';
	console.log('Pausing', id);
};

var resume = function (id) {
	soundManager.resume(id);
	state.audio = 'playing';
	console.log('Resuming', id);
};

var next = function ( ) {
	console.log('Next item');
	var index = collection.getCollectionOrder().indexOf(state.currentId);
	var id = collection.getCollectionOrder()[index + 1] || collection.getCollectionOrder()[0];
	var song = collection.getCollection()[id];

	if (!song.available) {
		id = collection.getCollectionOrder()[index + 2] || collection.getCollectionOrder()[0];
		return play(id);
	}

	play(id);
};

var previous = function ( ) {
	console.log('Previous item');
	var index = collection.getCollectionOrder().indexOf(state.currentId);
	var id = collection.getCollectionOrder()[index - 1] || collection.getCollectionOrder()[collection.getCollectionOrder().length - 1];
	var song = collection.getCollection()[id];

	if (!song.available) {
		id = collection.getCollectionOrder()[index - 2] || collection.getCollectionOrder()[collection.getCollectionOrder().length - 1];
		return play(id);
	}

	play(id);
};

var stop = function (id) {
	soundManager.stop(id);
	state.audio = 'stopped';
	console.log('Stopping', id);
	// TEMP: Shouldn't this also reset documentTitle?
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
