/*jslint browser: true */
/*global SoundManager, Cloudlist, convertToReadableTime */

;(function () {
	'use strict';

	Cloudlist.audio = (function () {
		var s, state; // Private aliases: settings

		// Try catch to make Firefox allow localStorage
		var isLocalStorageAllowed;
		try {
			window.localStorage.volume;
			isLocalStorageAllowed = true;
		} catch (err) {
			isLocalStorageAllowed = false;
		}

		return {
			settings: {
				volume: (isLocalStorageAllowed ? window.localStorage.volume : 90) || 90, // Default value is always 90
				key: '879664becb66c01bf10c8cf0fd4fbec3',
				cdn: Cloudlist.settings.cdn + '/media/audio/'
			},

			state: {
				audio: 'idle',
				muted: false,
				currentId: ''
			},

			init: function ( ) {
				s = this.settings;
				state = this.state;
				Cloudlist.cache.elems.volume.value = s.volume;

				// Autostart song if there is any
				var _this = this;
				var autostartId = window.autostart;
				function checkIfCollectionHasLoaded () {
					if (Object.keys(Cloudlist.cache.collection.items).length !== 0) {
						_this.play(autostartId);
					} else {
						window.setTimeout(checkIfCollectionHasLoaded, 100);
					}
				}
				if (autostartId) {
					checkIfCollectionHasLoaded();
				}
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
					Cloudlist.cache.elems.volume.value = s.volume;
				} else {
					soundManager.mute(state.currentId);
					state.muted = true;

					// Set volume slider to 0
					Cloudlist.cache.elems.volume.value = 0;
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

				var song = Cloudlist.cache.collection.items[id];
				var url = song.audio.source === 'soundcloud' ? song.audio.stream + '?consumer_key=' + s.key : s.cdn + song.audio.url;
				var elem = Cloudlist.cache.elems.collection.querySelector('[data-id="' + id + '"]');
				var elemLink = elem.firstChild;

				// Insert duration element
				var time = elem.getElementsByClassName('time')[0];
				var firstChild = time.firstChild;
				var currentProgress = document.createElement('span');
				currentProgress.innerHTML = '0:00 / ';
				time.insertBefore(currentProgress, firstChild);

				// Insert progress element
				var progressBar = document.createElement('div');
				progressBar.className = 'progress';
				elemLink.appendChild(progressBar);

				// Insert play icon
				var iconState = Helper.createSVGFragment('icon-audio-playing', '0 0 73.784 58.753');
				iconState.setAttribute('class', 'state-playing');
				elemLink.insertBefore(iconState, elemLink.firstChild);

				// Add loading class
				elem.classList.add('loading');

				// Add random palette color
				var color = 'color-' + Math.floor(Math.random() * 8);
				elem.classList.add(color);

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
							elem.classList.remove('loading');
							elem.classList.remove(color);
							elem.classList.add('unavailable');
							console.log(url, 'has failed loading');
							// TODO: Send message to server saying the track is not available anymore
							this.next();
						}
					}.bind(this),
					onplay: function ( ) {
						console.log('Playing stream', url);
						elem.classList.remove('loading');
						elem.classList.add('playing');
					},
					onpause: function ( ) {
						elem.classList.remove('playing');
						elem.classList.add('paused');

						var pauseIcon = Helper.updateSVGFragment(iconState, 'icon-audio-paused');
						pauseIcon.setAttribute('class', 'state-paused');
					},
					onresume: function ( ) {
						elem.classList.remove('paused');
						elem.classList.add('playing');

						var pauseIcon = Helper.updateSVGFragment(iconState, 'icon-audio-playing');
						pauseIcon.setAttribute('class', 'state-playing');
					},
					onstop: function ( ) {
						elem.classList.remove(color);
						elem.classList.remove('paused');
						elem.classList.remove('playing');
						state.audio = 'stopped';
						this.destroy(id);

						// Remove DOM elements
						iconState.parentNode.removeChild(iconState);
						currentProgress.parentNode.removeChild(currentProgress);
						progressBar.parentNode.removeChild(progressBar);
					}.bind(this),
					onfinish: function ( ) {
						elem.classList.remove(color);
						elem.classList.remove('paused');
						elem.classList.remove('playing');
						state.audio = 'stopped';
						this.destroy(id);

						// Remove DOM elements
						iconState.parentNode.removeChild(iconState);
						currentProgress.parentNode.removeChild(currentProgress);
						progressBar.parentNode.removeChild(progressBar);
						this.next();
					}.bind(this),
					whileplaying: function ( ) {
						var duration = this.duration;
						var position = this.position - song.audio.starttime;
						var percent = position / duration * 100;

						currentProgress.innerHTML = Helper.convertToReadableTime(position + 500) + ' / ';
						progressBar.style.width = percent + '%';
					}
				});

				sound.setPosition(song.audio.starttime); // Set custom starttime
				sound.play();

				if (state.muted) {
					sound.mute();
				}

				// Set state
				state.audio = 'playing';

				// Update browser history
				var href = Helper.structureSlugs(song.slugs);
				Cloudlist.history.update(id, href);

				// Scroll to track if out of bounds
				if (!Helper.inViewport(elem, 250)) {
					Cloudlist.scrollToElement(elem);
				}


				// Unfocus previous item
				if (Cloudlist.cache.elems.currentItem) {
					var prevElem = Cloudlist.cache.elems.currentItem;
					Cloudlist.cache.elems.currentItem = null;
					Helper.simulateMouseEvent(prevElem.firstChild, 'mouseout');
				}

				// Load item cover & scroll overflowing text
				Helper.simulateMouseEvent(elem.firstChild, 'mouseover');

				// Cache node/element globally
				Cloudlist.cache.elems.currentItem = elem;
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

				// Scroll to track
				var elem = Cloudlist.cache.elems.collection.querySelector('[data-id="' + id + '"]');
				Cloudlist.scrollToElement(elem);
			},

			next: function ( ) {
				console.log('Next item');
				var index = Cloudlist.cache.collection.order.indexOf(state.currentId);
				var id = Cloudlist.cache.collection.order[index + 1] || Cloudlist.cache.collection.order[0];
				var song = Cloudlist.cache.collection.items[id];

				if (!song.available) {
					id = Cloudlist.cache.collection.order[index + 2] || Cloudlist.cache.collection.order[0];
					return this.play(id);
				}

				this.play(id);
			},

			previous: function ( ) {
				console.log('Previous item');
				var index = Cloudlist.cache.collection.order.indexOf(state.currentId);
				var id = Cloudlist.cache.collection.order[index - 1] || Cloudlist.cache.collection.order[Cloudlist.cache.collection.order.length - 1];
				var song = Cloudlist.cache.collection.items[id];

				if (!song.available) {
					id = Cloudlist.cache.collection.order[index - 2] || Cloudlist.cache.collection.order[Cloudlist.cache.collection.order.length - 1];
					return this.play(id);
				}

				this.play(id);
			},

			stop: function (id) {
				soundManager.stop(id);
				state.audio = 'stopped';
				console.log('Stopping', id);
			},

			stopAll: function ( ) {
				var items = Cloudlist.cache.collection.order;
				for (var i = 0, len = items.length; i < len; i++) {
					this.stop(items[i]);
				}
			}

		};
	}());
}());