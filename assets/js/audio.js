'use strict';

// Requires
require('./vendor/soundmanager2-nodebug-jsmin.js');
var utils = require('./utils.js');
var config = require('./config.js');
var pubsub = require('./pubsub.js');

// Private aliases
var s;

// Private variables
var collection;
var state;

module.exports = {

	settings: {
		volume: (utils.isLocalStorageAllowed() ? window.localStorage.volume : 90) || 90, // Default value is always 90
		key: '879664becb66c01bf10c8cf0fd4fbec3',
		path: config.settings.cdn + '/media/audio/'
	},

	state: {
		audio: 'idle',
		muted: false,
		currentId: ''
	},

	init: function (data) {
		collection = data;

		s = this.settings;
		state = this.state;
	},

	setVolume: function (volume) {
		state.currentId && soundManager.getSoundById(state.currentId).setVolume(volume);
		window.localStorage.volume = volume;
		s.volume = volume;
	},

	toggleMute: function ( ) {
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
	},

	toggle: function (id) {
		// Toggle play, resume or pause depending on states
		if (id && id !== state.currentId) {
			this.play(id);
		} else if (state.audio === 'paused') {
			this.resume(state.currentId);
		} else {
			this.pause(state.currentId);
		}
	},

	destroy: function (id) {
		soundManager.destroySound(id);
	},

	play: function (id) {
		// First stop the currently playing sound, if any
		if (state.currentId) {
			this.stop(state.currentId);
		}
		state.currentId = id;

		var song = collection.items[id];
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
			onload: function (success) {
				if (!success) {
					console.log(url, 'has failed loading');

					pubsub.publish('audioFailedLoading', id);

					// TODO: Send message to server saying the track is not available anymore
					this.next();
				}
			}.bind(this),
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

				this.destroy(id);
			}.bind(this),
			onfinish: function ( ) {
				// TEMP: CALL this.stop() here

				state.audio = 'stopped';
				this.destroy(id);
				this.next();
			}.bind(this),
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
	},

	pause: function (id) {
		if (!id) {
			id = state.currentId;
		}
		soundManager.pause(id);
		state.audio = 'paused';
		console.log('Pausing', id);
	},

	resume: function (id) {
		soundManager.resume(id);
		state.audio = 'playing';
		console.log('Resuming', id);
	},

	next: function ( ) {
		console.log('Next item');
		var index = collection.order.indexOf(state.currentId);
		var id = collection.order[index + 1] || collection.order[0];
		var song = collection.items[id];

		if (!song.available) {
			id = collection.order[index + 2] || collection.order[0];
			return this.play(id);
		}

		this.play(id);
	},

	previous: function ( ) {
		console.log('Previous item');
		var index = collection.order.indexOf(state.currentId);
		var id = collection.order[index - 1] || collection.order[collection.order.length - 1];
		var song = collection.items[id];

		if (!song.available) {
			id = collection.order[index - 2] || collection.order[collection.order.length - 1];
			return this.play(id);
		}

		this.play(id);
	},

	stop: function (id) {
		soundManager.stop(id);
		state.audio = 'stopped';
		console.log('Stopping', id);
		// TEMP: Shouldn't this also reset documentTitle?
	},

	stopAll: function ( ) {
		var items = collection.order;
		for (var i = 0, len = items.length; i < len; i++) {
			this.stop(items[i]);
		}
	},

};