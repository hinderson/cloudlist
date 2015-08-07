'use strict';

// Requires
var history = require('./history.js'); // jshint ignore:line
var utils = require('./utils.js');
var config = require('./config.js');
var pubsub = require('./pubsub.js');
var audio = require('./audio.js');
var collection = require('./data/collection.js');

// Private aliases: settings, cache
var s, c;

// Private variables
var ticking = false;
var lastScrollY = null;

// Private functions
var itemClickHandler = function (e) {
	e.preventDefault();

	var id = e.delegateTarget.parentNode.getAttribute('data-id');
	audio.toggleState(id);
};

var itemHoverHandler = function (e) {
	var target = e.delegateTarget;

	switch (e.type) {
		case 'mouseover':
			this.loadItemCover(target);
			this.scrollOverflowingText(target);
			break;
		case 'mouseout':
			this.scrollOverflowingText(target, true);
			break;
	}
};

var sortClickHandler = function (e) {
	e.preventDefault();

	var target = e.target;
	var targetContent = e.target.textContent;
	var reverse = e.target.className === 'asc' ? true : false;

	// First remove previous <strong> tag
	var strong = e.delegateTarget.parentNode.parentNode.getElementsByTagName('strong')[0];
	if (strong && strong !== target) {
		var span = document.createElement('span');
		span.innerHTML = strong.textContent;
		strong.parentNode.insertBefore(span, strong);
		strong.parentNode.removeChild(strong);
	}

	// Actually sort the collection
	var items = collection.getCollection();
	var type = e.target.parentNode.getAttribute('data-sort-type');
	collection.sortCollection(items, type, reverse).forEach(function (i) {
		var index = items[i].index;
		c.elems.collectionItems[0].parentNode.appendChild(c.elems.collectionItems[index]);
	});

	// Create new <strong> and replace it with the previous tag
	var newStrong = document.createElement('strong');
	newStrong.textContent = targetContent;

	if (reverse) {
		newStrong.classList.remove('asc');
		newStrong.classList.add('desc');

		var desc = utils.createSVGFragment('icon-caret-desc', '0 0 586.666 293.333');
		newStrong.appendChild(desc);
	} else {
		newStrong.classList.remove('desc');
		newStrong.classList.add('asc');

		var asc = utils.createSVGFragment('icon-caret-asc', '0 0 612 306');
		newStrong.appendChild(asc);
	}

	target.parentNode.appendChild(newStrong);
	target.parentNode.removeChild(target);

	pubsub.publish('forceCollectionRepaint');
};

module.exports = {

	cache: {
		elems: {
			HTML: document.getElementsByTagName('html')[0],
			heroContent: document.getElementsByClassName('hero-inner')[0],
			heroImage: document.querySelector('.hero picture'),
			collectionHeader: document.getElementsByClassName('collection-header')[0],
			collectionTitle: document.getElementsByClassName('collection-title')[0],
			collectionSubTitle: document.getElementsByClassName('collection-sub-title')[0],
			collection: document.getElementsByClassName('collection')[0],
			collectionItems: document.querySelectorAll('.collection ol li'),
			scrollableOverflowElems: document.querySelectorAll('.artist, .title'),
			sort: document.getElementsByClassName('sort')[0],
			closeDialog: document.getElementsByClassName('close-dialog')[0],
			dialogOverlay: document.getElementsByClassName('dialog-overlay')[0],
			infoBtn: document.getElementsByClassName('info-toggle')[0],
			playStateBtn: document.getElementsByClassName('play-state')[0],
			fullscreen: document.getElementsByClassName('fullscreen')[0],
			volume: document.getElementsByClassName('volume-slider')[0],
			options: document.getElementsByClassName('options')[0],
			goToTop: document.getElementsByClassName('go-to-top')[0].firstChild,
			currentItem: null
		},
		coversLoaded: [],
		mousePosition: {
			x: 0,
			y: 0
		},
		collectionTop: utils.getElemDistanceFromDoc(document.getElementsByClassName('collection')[0]).top
	},

	init: function ( ) {
		c = this.cache;
		s = config.settings;

		this.setupAudio();
		this.registerEvents();
		this.registerKeyboardEvents();
		this.toggleStickyHeader();
		this.findOverflowingElements();
		this.storeViewportDimensions();

		// Get collection
		var id = c.elems.collection.getAttribute('data-id');
		collection.setCollection(id, function (res) {
			// Set document title
			s.documentTitle = res.collection.title + ' – Cloudlist.io';

			// Autostart song if there is any
			if (window.autostart) {
				audio.play(window.autostart);
			}
		});

		// Init history
		history.init();

		// Trigger resize event when window has been focused again
		pubsub.subscribe('windowFocused', function ( ) {
			this.resizeEvent();
		}.bind(this));
	},

	registerEvents: function ( ) {
		c.elems.collection.addEventListener('click', utils.delegate(utils.criteria.hasTagName('a'), itemClickHandler), false);

		c.elems.collection.addEventListener('mouseover', utils.delegate(utils.criteria.hasTagName('a'), itemHoverHandler.bind(this)), false);

		c.elems.collection.addEventListener('mouseout', utils.delegate(utils.criteria.hasTagName('a'), itemHoverHandler.bind(this)), false);

		c.elems.sort.addEventListener('click', utils.delegate(utils.criteria.hasTagNames(['span', 'strong']), sortClickHandler), false);

		c.elems.fullscreen.addEventListener('click', this.toggleFullscreen, false);

		c.elems.playStateBtn.addEventListener('click', function ( ) {
			audio.toggleState();
		}, false);

		c.elems.infoBtn.addEventListener('click', this.toggleDialog, false);

		c.elems.dialogOverlay.addEventListener('click', function ( ) {
			c.elems.HTML.classList.remove('overlay');
		}, false);

		c.elems.closeDialog.addEventListener('click', function ( ) {
			c.elems.HTML.classList.remove('overlay');
		}, false);

		c.elems.volume.addEventListener('input', function (e) {
			audio.setVolume(e.target.value);
		}.bind(this), false);

		c.elems.goToTop.addEventListener('click', function (e) {
			e.preventDefault();
			this.scrollToPosition(0, 400);
		}.bind(this), false);

		c.elems.collectionSubTitle.addEventListener('click', function (e) {
			this.scrollToPosition(0, 400);
		}.bind(this), false);

		document.addEventListener('mousemove', function (e) {
			this.storeMousePosition(e.x, e.y);
		}.bind(this), false);

		window.addEventListener('scroll', function (e) {
			this.scrollEvent();
		}.bind(this), false);

		window.addEventListener('resize', function (e) {
			this.resizeEvent();
		}.bind(this), false);

		// Window focus
		var visibilityChange = utils.getVisibilityVendor().visibilityChange;
		document.addEventListener(visibilityChange, this.handleVisibilityChange, false);
	},

	storeViewportDimensions: function ( ) {
		this.viewportWidth = window.innerWidth;
		this.viewportHeight = window.innerHeight;
	},

	storeMousePosition: utils.debounce(function (x, y) {
		c.mousePosition = {
			x: x,
			y: y
		};
	}, 150),

	scrollEvent: function ( ) {
		lastScrollY = window.pageYOffset;

		var requestTick = function ( ) {
			this.throttleHoverStates();
			this.toggleStickyHeader();

			// Re-focus on currently playing track
			window.clearTimeout(this.focusInterval);
			this.focusInterval = window.setTimeout(function ( ) {
				var elem = c.elems.currentItem;
				if (elem && !utils.inViewport(elem, 250) && audio.getState().audio === 'playing') {
					this.scrollToElement(elem);
				} else {
					window.clearTimeout(this.focusInterval);
				}
			}.bind(this), 6000);

			pubsub.publish('scrolling', lastScrollY);

			// Stop ticking
			ticking = false;
		};

		if (!ticking) {
			utils.requestAnimFrame.call(window, requestTick.bind(this));
			ticking = true;
		}
	},

	throttleHoverStates: function ( ) {
		c.elems.HTML.classList.add('scrolling');
		window.clearTimeout(this.throttle);
		this.throttle = window.setTimeout(function ( ) {
			c.elems.HTML.classList.remove('scrolling');
		}, 100);
	},

	resizeEvent: utils.debounce(function ( ) {
		this.storeViewportDimensions();

		// Find overflowing elements and determine animation duration based on elem width
		this.findOverflowingElements();

		// Update position of collection top
		c.collectionTop = utils.getElemDistanceFromDoc(c.elems.collection).top;

		pubsub.publish('resize');
	}, 250),

	findOverflowingElements: function ( ) {
		var elems = c.elems.scrollableOverflowElems;
		utils.forEach(elems, function (index, item) {
			if (utils.isOverflowed(item)) {
				item.setAttribute('data-char-count', item.firstChild.textContent.length);
				item.classList.add('overflow');
			} else {
				item.removeAttribute('data-char-count');
				item.classList.remove('overflow');
			}
		});
	},

	toggleStickyHeader: function ( ) {
		var scrollPosition = lastScrollY || window.pageYOffset;
		if (scrollPosition > c.collectionTop) {
			c.elems.HTML.classList.add('sticky-header');
		} else {
			c.elems.HTML.classList.remove('sticky-header');
		}
	},

	toggleFullscreen: function ( ) {
		document.fullscreenEnabled =
			document.fullscreenEnabled ||
			document.mozFullScreenEnabled ||
			document.msFullscreenEnabled ||
			document.documentElement.webkitRequestFullScreen;

		if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
			if (document.documentElement.requestFullscreen) {
				document.documentElement.requestFullscreen();
			} else if (document.documentElement.msRequestFullscreen) {
				document.documentElement.msRequestFullscreen();
			} else if (document.documentElement.mozRequestFullScreen) {
				document.documentElement.mozRequestFullScreen();
			} else if (document.documentElement.webkitRequestFullscreen) {
				document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
			}

			pubsub.publish('fullscreen', true);
		} else {
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.msExitFullscreen) {
				document.msExitFullscreen();
			} else if (document.mozCancelFullScreen) {
				document.mozCancelFullScreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			}

			pubsub.publish('fullscreen', false);
		}
	},

	toggleDialog: function ( ) {
		c.elems.HTML.classList.toggle('overlay');
	},

	registerKeyboardEvents: function ( ) {
		var keys = [];

		var keysPressed = function (e) {
			e = e || window.event;
			keys[e.which || e.keyCode] = true;

			switch(e.which || e.keyCode) {
				// Enter
				case 13:
					e.preventDefault();
					console.log('Enter');
					break;

				// Esc
				case 27:
					e.preventDefault();
					c.elems.HTML.classList.remove('overlay');
					console.log('Esc');
					break;

				// Space
				case 32:
					e.preventDefault();
					console.log('Space');
					audio.toggleState();
					break;

				// Left & up arrow
				case 38:
				case 37:
					e.preventDefault();
					console.log('Left arrow');
					audio.previous();
					break;

				// Right & down arrow
				case 39:
				case 40:
					e.preventDefault();
					console.log('Right or down arrow');
					audio.next();
					break;

				// Fullscreen
				case 16: // Alt
				case 70: // F
					e.preventDefault();
					console.log('Alt or F');
					if (keys[16] && keys[70]) {
						this.toggleFullscreen();
					}
					break;

				// Mute sound
				case 77:
					e.preventDefault();
					console.log('M');
					audio.toggleMute();
					break;

				default: return;
			}
		}.bind(this);

		var keysReleased = function (e) {
			keys[e.keyCode] = false;
		};

		window.addEventListener('keydown', keysPressed, false);
		window.addEventListener('keyup', keysReleased, false);
	},

	scrollOverflowingText: function (target, reset) {
		// Bounce – i.e. don't reset or retrigger any values if current item is already playing/is paused
		if (target.parentNode === c.elems.currentItem) {
			return;
		}

		var items = target.children;
		utils.forEach(items, function (index, item) {
			if (item.classList.contains('overflow')) {
				if (reset) {
					item.classList.remove('scroll-overflow');

					// Remove cloned span
					var clonedSpan = item.children[1];
					utils.requestAnimFrame.call(window, function ( ) {
						clonedSpan && clonedSpan.remove();
					});
				} else if (!item.classList.contains('scroll-overflow')) {
					item.classList.add('scroll-overflow');

					// Clone and append span
					var clone = item.firstElementChild.cloneNode(true);
					utils.requestAnimFrame.call(window, function ( ) {
						item.appendChild(clone);
					});
				}
			}
		});
	},

	scrollToPosition: function (destination, duration, callback) {
		var start = lastScrollY;
		var startTime = 0;
		var delta = destination - start;

		// Default easing function
		function easing (t, b, c, d) {
			t /= d / 2;
			if (t < 1) {
				return c / 2 * t * t * t + b;
			}
			t -= 2;
			return c / 2 * (t * t * t + 2) + b;
		}

		function loop (time) {
			startTime || (startTime = time);
			var runTime = time - startTime;

			if (duration > runTime) {
				utils.requestAnimFrame.call(window, loop);
				window.scrollTo(0, easing(runTime, start, delta, duration));
			} else {
				if (destination !== delta + start) {
					window.scrollTo(0, delta + start);
				}
				if (typeof callback === 'function') {
					callback(+new Date());
				}
			}
		}

		utils.requestAnimFrame.call(window, loop);
	},

	scrollToElement: function (element) {
		var rect = element.getBoundingClientRect();
		var offsetTop = rect.top + lastScrollY;
		var offset = (this.viewportHeight / 2) - (rect.height / 2);

		this.scrollToPosition(offsetTop - offset, 500);
	},

	loadItemCover: function (target) {
		var parentNode = target.parentNode;
		var id = parentNode.getAttribute('data-id');

		if (this.viewportWidth < 685) {
			return;
		}

		// If AJAX call hasn't been completed yet
		if (collection.getCollection() === null) {
			return;
		}

		if (c.coversLoaded.indexOf(id) === -1) {
			var item = collection.getCollection()[id].covers[0];
			var format = (item.format === 'MP4' && utils.canPlayMP4()) ? 'video' : 'img';
			var cdn = s.cdn + format + '/';
			var cover = document.createElement(format);
			var filename;

			// Below checks both for video and if the mp4 format is supported in the browser
			if (format === 'video') {
				filename = cdn + item.filename;
				cover.setAttribute('autoplay', '');
				cover.setAttribute('loop', '');
			} else {
				filename = cdn + (item.screenshot ? item.screenshot : item.filename);
				cover.setAttribute('alt', '');
			}

			cover.setAttribute('src', filename);
			cover.className = 'cover';
			cover.setAttribute('width', item.width);
			cover.setAttribute('height', item.height);

			utils.requestAnimFrame.call(window, function ( ) {
				parentNode.appendChild(cover);
			});
			c.coversLoaded.push(id);

			this.randomCoverPosition(id, cover);
		} else if (!(parentNode.classList.contains('playing') || parentNode.classList.contains('paused') || parentNode.classList.contains('loading'))) { // Reposition again if cover has already been loaded
			this.randomCoverPosition(id);
		}
	},

	randomCoverPosition: function (id, cover) {
		var item = collection.getCollection()[id].covers[0];
		cover = cover || document.querySelector('[data-id="' + id + '"] .cover');

		var topPos = Math.floor(Math.random() * (-(item.height - 100) - (-30)) + (- 30));
		var margin = (4 / 100) * this.viewportWidth; // The number 3 here is the percentage
		var leftMin = margin;
		var leftMax = (this.viewportWidth - item.width) - margin;
		var leftPos = Math.floor(Math.random() * (leftMax - leftMin)) + leftMin;

		utils.requestAnimFrame.call(window, function ( ) {
			cover.style.cssText = 'top: ' + topPos +'px; left: ' + leftPos +'px';
		});
	},

	setupAudio: function ( ) {
		// Set initial (visual) volume state
		c.elems.volume.value = audio.getVolume();

		// Private variables
		var elem, currentProgress, progressBar, iconState, color, position, percent;

		var loading = function (id) {
			elem = c.elems.collection.querySelector('[data-id="' + id + '"]');

			// Add loading class
			c.elems.HTML.classList.add('loading-song');
			elem.classList.add('loading');

			// Unfocus previous item
			var prevElem = c.elems.currentItem;
			if (prevElem) {
				c.elems.currentItem = null;
				prevElem.firstChild.blur();
				utils.simulateMouseEvent(prevElem.firstChild, 'mouseout');
			}

			// Load item cover & scroll overflowing text
			utils.simulateMouseEvent(elem.firstChild, 'mouseover');

			// Store element globally
			c.elems.currentItem = elem;

			// Scroll to track if out of bounds
			if (!utils.inViewport(elem, 250)) {
				this.scrollToElement(elem);
			}
		}.bind(this);

		var failed = function (id) {
			elem = c.elems.collection.querySelector('[data-id="' + id + '"]');
			c.elems.HTML.classList.remove('loading-song');
			elem.classList.remove('loading');
			elem.classList.remove(color);
			elem.classList.add('unavailable');
		};

		var playing = function (id) {
			var song = collection.getCollection()[id];
			var elemLink = elem.firstChild;

			// Update browser history (incl. document title)
			var href = elemLink.href;
			var documentTitle = '▶ ' + utils.makeDocumentTitle([utils.structureArtists(song.artist, song.featuredartist), '"' + song.title + '"'], ', ');
			history.update(id, href, documentTitle);

			c.elems.HTML.classList.remove('loading-song');
			elem.classList.remove('loading');
			elem.classList.add('playing');

			// Insert duration element
			var time = elem.getElementsByClassName('time')[0];
			var firstChild = time.firstChild;
			currentProgress = document.createElement('span');
			utils.requestAnimFrame.call(window, function ( ) {
				currentProgress.innerHTML = '0:00 / ';
				time.insertBefore(currentProgress, firstChild);
			});

			// Insert progress element and add duration
			progressBar = document.createElement('div');
			progressBar.className = 'progress';
			progressBar.style.webkitAnimationDuration = song.audio.duration + 'ms';
			progressBar.style.mozAnimationDuration = song.audio.duration + 'ms';
			progressBar.style.animationDuration = song.audio.duration + 'ms';
			utils.requestAnimFrame.call(window, function ( ) {
				elemLink.appendChild(progressBar);
			});

			// Insert play icon
			iconState = utils.createSVGFragment('icon-audio-playing', '0 0 73.784 58.753');
			iconState.setAttribute('class', 'state-playing');
			utils.requestAnimFrame.call(window, function ( ) {
				elemLink.insertBefore(iconState, elemLink.firstChild);
			});

			// Add random palette color
			color = 'color-' + Math.floor(Math.random() * 8);
			elem.classList.add(color);

			// Set global state
			c.elems.playStateBtn.classList.add('playing');
		};

		var paused = function ( ) {
			elem.classList.remove('playing');
			elem.classList.add('paused');

			var pauseIcon = utils.updateSVGFragment(iconState, 'icon-audio-paused');
			utils.requestAnimFrame.call(window, function ( ) {
				pauseIcon.setAttribute('class', 'state-paused');
			});

			// Update document title to remove ▶ character
			var documentTitle = window.history.state.title.replace('▶ ', '');
			history.updateDocumentTitle(documentTitle);

			// Set global state
			c.elems.playStateBtn.classList.remove('playing');
		};

		var resumed = function ( ) {
			elem.classList.remove('paused');
			elem.classList.add('playing');

			var pauseIcon = utils.updateSVGFragment(iconState, 'icon-audio-playing');
			utils.requestAnimFrame.call(window, function ( ) {
				pauseIcon.setAttribute('class', 'state-playing');
			});

			// Update document title with ▶ character
			var documentTitle = '▶ ' + window.history.state.title;
			history.updateDocumentTitle(documentTitle);

			// Scroll to track
			this.scrollToElement(elem);

			// Set global state
			c.elems.playStateBtn.classList.add('playing');
		}.bind(this);

		var stopped = function ( ) {
			// Remove all classes
			elem.classList.remove(color);
			elem.classList.remove('paused');
			elem.classList.remove('playing');

			// Remove DOM elements but first check if they are actually in the DOM, just in case
			if (utils.isInDOM(iconState)) {
				iconState.parentNode.removeChild(iconState);
				currentProgress.parentNode.removeChild(currentProgress);
				progressBar.parentNode.removeChild(progressBar);
			}

			// Set global state
			c.elems.playStateBtn.classList.remove('playing');
		};

		var updating = function (args) {
			position = args[0];
			percent = args[1];

			utils.requestAnimFrame.call(window, function ( ) {
				currentProgress.innerHTML = utils.convertToReadableTime(position + 500) + ' / ';
			});
		};

		var muted = function ( ) {
			c.elems.volume.value = 0;
		};

		var unmuted = function (volume) {
			c.elems.volume.value = volume;
		};

		var historyChanged = function (id) {
			if (id) {
				audio.play(id);
			} else {
				audio.stop();
				this.scrollToPosition(0, 400);
			}
		}.bind(this);

		var forceProgressRepaint = function ( ) {
			if (audio.getState().audio !== 'playing') return;

			// Since Safari 8 pauses all animation when switching to another tab,
			// we have to retrigger the animation when this tab retains focus

			// Give the browser some time catch up
			setTimeout(function ( ) {
				var currentSong = collection.getCollection()[audio.getState().currentId];
				var currentPercent = percent - 100;
				var timeLeft = currentSong.audio.duration - position;

				var clone = progressBar.cloneNode(true);
				progressBar.parentNode.replaceChild(clone, progressBar);

				clone.style.webkitTransform = 'translate3d(' + currentPercent +'%, 0, 0)';
				clone.style.webkitAnimation = 'progress-bar ' + timeLeft + 'ms linear both';

				progressBar = clone;
			}, 300);
		};

		pubsub.subscribe('audioLoading', loading);
		pubsub.subscribe('audioFailedLoading', failed);
		pubsub.subscribe('audioPlaying', playing);
		pubsub.subscribe('audioPaused', paused);
		pubsub.subscribe('audioResumed', resumed);
		pubsub.subscribe('audioStopped', stopped);
		pubsub.subscribe('audioUpdating', updating);
		pubsub.subscribe('audioMuted', muted);
		pubsub.subscribe('audioUnmuted', unmuted);
		pubsub.subscribe('historyChanged', historyChanged);
		pubsub.subscribe('windowFocused', forceProgressRepaint);
		pubsub.subscribe('forceCollectionRepaint', forceProgressRepaint);
	},

	handleVisibilityChange: function ( ) {
		var hidden = utils.getVisibilityVendor().hidden;
		if (!document[hidden]) {
			pubsub.publish('windowFocused');
		}
	}

};
