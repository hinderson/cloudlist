'use strict';

// Requires
require('./vendor/soundmanager2-nodebug-jsmin.js');
var utils = require('./utils.js');
var config = require('./config.js');
var pubsub = require('./pubsub.js');
var collection = require('./data/collection.js');

// Private aliases
var s;

// Private variables
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

	init: function ( ) {
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

	toggleState: function (id) {
		if (id && id !== state.currentId) {
			this.play(id);
		} else if (state.audio === 'paused') {
			this.resume(state.currentId);
		} else if (state.currentId) {
			this.pause(state.currentId);
		} else {
			var id = collection.getCollectionOrder()[0];
			this.play(id);
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
				state.audio = 'stopped';
				pubsub.publish('audioStopped', id);

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
		var index = collection.getCollectionOrder().indexOf(state.currentId);
		var id = collection.getCollectionOrder()[index + 1] || collection.getCollectionOrder()[0];
		var song = collection.getCollection()[id];

		if (!song.available) {
			id = collection.getCollectionOrder()[index + 2] || collection.getCollectionOrder()[0];
			return this.play(id);
		}

		this.play(id);
	},

	previous: function ( ) {
		console.log('Previous item');
		var index = collection.getCollectionOrder().indexOf(state.currentId);
		var id = collection.getCollectionOrder()[index - 1] || collection.getCollectionOrder()[collection.getCollectionOrder().length - 1];
		var song = collection.getCollection()[id];

		if (!song.available) {
			id = collection.getCollectionOrder()[index - 2] || collection.getCollectionOrder()[collection.getCollectionOrder().length - 1];
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
		var items = collection.getCollectionOrder();
		for (var i = 0, len = items.length; i < len; i++) {
			this.stop(items[i]);
		}
	},

};