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
			if (target !== this.currentHover) {
				this.currentHover = target;
				this.scrollOverflowingText(target);
				if (!(target.parentNode.classList.contains('playing') ||
					target.parentNode.classList.contains('paused') ||
					target.parentNode.classList.contains('loading'))) {
						this.showItemCover(target);
					}
				pubsub.publish('itemMouseover', target);
			}
			break;
		case 'mouseout':
			this.scrollOverflowingText(target, true);
			pubsub.publish('itemMouseout', target);
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
	var items = collection.getAllItems();
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
			HTML: document.documentElement || document.body,
			body: document.getElementsByTagName('body')[0],
			heroContent: document.getElementsByClassName('hero-inner')[0],
			headerShadow: document.getElementsByClassName('header-shadow')[0],
			collectionHeader: document.getElementsByClassName('collection-header')[0],
			collectionTitle: document.getElementsByClassName('collection-title')[0],
			collectionSubTitle: document.getElementsByClassName('collection-sub-title')[0],
			collection: document.getElementsByClassName('collection')[0],
			collectionItems: document.querySelectorAll('.collection ol li'),
			scrollableOverflowElems: document.querySelectorAll('.collection ol .col-artist, .collection ol .col-title'),
			sort: document.getElementsByClassName('sort-collection')[0],
			dialog: document.getElementsByClassName('dialog')[0],
			closeDialog: document.getElementsByClassName('close-dialog')[0],
			dialogOverlay: document.getElementsByClassName('dialog-overlay')[0],
			infoBtn: document.getElementsByClassName('info-toggle')[0],
			playStateBtn: document.getElementsByClassName('play-state')[0],
			fullscreen: document.getElementsByClassName('fullscreen')[0],
			volume: document.getElementsByClassName('volume-slider')[0],
			options: document.getElementsByClassName('options')[0],
			currentItem: null
		},
		mousePosition: {
			x: 0,
			y: 0
		},
		collectionTop: utils.getElemDistanceFromDoc(document.getElementsByClassName('collection')[0]).top
	},

	init: function ( ) {
		c = this.cache;
		s = config.settings;

		this.registerEvents();
		this.setupAudio();
		this.registerKeyboardEvents();
		this.toggleStickyHeader();
		this.findOverflowingElements();
		this.viewportWidth = window.innerWidth;
		this.viewportHeight = window.innerHeight;

		// Get collection
		collection.getCollection.then(function (res) {
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
			if (window.innerWidth !== this.viewportWidth || window.innerHeight !== this.viewportHeight) {
				this.resizeEvent();
			}
		}.bind(this));
	},

	registerEvents: function ( ) {
		c.elems.collection.addEventListener('click', utils.delegate(utils.criteria.hasTagName('a'), itemClickHandler));

		c.elems.collection.addEventListener('mouseover', utils.delegate(utils.criteria.hasTagName('a'), itemHoverHandler.bind(this)));

		c.elems.collection.addEventListener('mouseout', utils.delegate(utils.criteria.hasTagName('a'), itemHoverHandler.bind(this)));

		c.elems.sort.addEventListener('click', utils.delegate(utils.criteria.hasTagNames(['span', 'strong']), sortClickHandler));

		c.elems.fullscreen.addEventListener('click', this.toggleFullscreen);

		c.elems.playStateBtn.addEventListener('click', function ( ) {
			audio.toggleState();
		});

		c.elems.infoBtn.addEventListener('click', this.toggleDialog);

		c.elems.dialogOverlay.addEventListener('click', function ( ) {
			this.toggleDialog();
		}.bind(this));

		c.elems.closeDialog.addEventListener('click', function ( ) {
			c.elems.HTML.classList.remove('overlay');
		});

		c.elems.volume.addEventListener('input', function (e) {
			audio.setVolume(e.target.value / 100);
		}.bind(this));

		c.elems.collectionSubTitle.addEventListener('click', function (e) {
			utils.scrollToPosition(0, 400);
		});

		document.addEventListener('mousemove', this.mouseEvent.bind(this));
		window.addEventListener('scroll', this.scrollEvent.bind(this));
		window.addEventListener('resize', this.resizeEvent.bind(this));

		// Window focus
		var visibilityChange = utils.getVisibilityVendor().visibilityChange;
		document.addEventListener(visibilityChange, this.handleVisibilityChange, false);

		// Analytics tracking
		document.querySelector('.export-options .export-to-spotify').addEventListener('click', function ( ) {
			/* jshint ignore:start */
			ga('send', {
				hitType: 'event',
				eventCategory: 'Export',
				eventAction: 'spotify',
				eventLabel: ''
			});
			/* jshint ignore:end */
		});

		document.querySelector('.export-options .download-csv').addEventListener('click', function ( ) {
			/* jshint ignore:start */
			ga('send', {
				hitType: 'event',
				eventCategory: 'Export',
				eventAction: 'csv',
				eventLabel: ''
			});
			/* jshint ignore:end */
		});
	},

	mouseEvent: utils.debounce(function (e) {
		// Store mouse position
		c.mousePosition = {
			x: e.x,
			y: e.y
		};
	}, 100),

	scrollEvent: function ( ) {
		lastScrollY = window.pageYOffset;

		var requestTick = function ( ) {
			this.throttleHoverStates();
			this.toggleStickyHeader();

			// Re-focus on currently playing track
			window.clearTimeout(this.focusInterval);
			this.focusInterval = window.setTimeout(function ( ) {
				var elem = c.elems.currentItem;
				if (elem && !utils.inViewport(elem, 250) && audio.getState() === 'playing') {
					utils.scrollToElement(elem);
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
		var prevWidth = this.viewportWidth;
		var prevHeight = this.viewportHeight;

		// Set new viewport dimensions
		this.viewportWidth = window.innerWidth;
		this.viewportHeight = window.innerHeight;

		// Remove or add overflowing text and reposition cover on currently playing item
		if (c.elems.currentItem !== null) {
			var widthDiff = Math.abs(prevWidth - this.viewportWidth);
			var heightDiff = Math.abs(prevHeight - this.viewportHeight);

			// Only reflow/reposition element if the diff between
			// previous size and new is more than 40px
			if (widthDiff >= 40 || heightDiff >= 40) {
				this.showItemCover(c.elems.currentItem.firstChild);
			}

			this.scrollOverflowingText(c.elems.currentItem.firstChild, true, true);

			setTimeout(function ( ) {
				this.findOverflowingElements();
				this.scrollOverflowingText(c.elems.currentItem.firstChild, false, true);
			}.bind(this), 1000);
		} else {
			this.findOverflowingElements();
		}

		// Update position of collection top
		c.collectionTop = utils.getElemDistanceFromDoc(c.elems.collection).top;

		pubsub.publish('resize');
	}, 250),

	findOverflowingElements: function ( ) {
		var elems = c.elems.scrollableOverflowElems;
		utils.forEach(elems, function (index, item) {
			utils.requestAnimFrame.call(window, function ( ) {
				if (utils.isOverflowed(item)) {
					item.setAttribute('data-char-count', item.firstChild.textContent.length);
					item.classList.add('overflow');
				} else {
					item.removeAttribute('data-char-count');
					item.classList.remove('overflow');
				}
			});
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

		if (!document.fullscreenElement && !document.mozFullScreenElement &&
				!document.webkitFullscreenElement && !document.msFullscreenElement) {
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
		if (c.elems.HTML.classList.contains('overlay')) {
			c.elems.dialog.setAttribute('aria-hidden', true);
			c.elems.HTML.classList.remove('overlay');
		} else {
			c.elems.dialog.setAttribute('aria-hidden', false);
			c.elems.HTML.classList.add('overlay');
		}
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
					break;

				// Esc
				case 27:
					e.preventDefault();
					c.elems.dialog.setAttribute('aria-hidden', true);
					c.elems.HTML.classList.remove('overlay');
					break;

				// Space
				case 32:
					e.preventDefault();
					audio.toggleState();
					break;

				// Left & up arrow
				case 38:
				case 37:
					e.preventDefault();
					audio.previous();
					break;

				// Right & down arrow
				case 39:
				case 40:
					e.preventDefault();
					audio.next();
					break;

				// Fullscreen
				case 16: // Alt
				case 70: // F
					if (keys[16] && keys[70]) {
						e.preventDefault();
						this.toggleFullscreen();
					}
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

	scrollOverflowingText: function (target, reset, force) {
		// Bounce – i.e. don't reset or retrigger any values if current item is already playing/is paused
		if (target.parentNode === c.elems.currentItem && !force) {
			return;
		}

		var resetScrolling = function (item) {
			item.classList.remove('scroll-overflow');

			// Remove cloned span
			var clonedSpan = item.children[1];
			if (clonedSpan) {
				clonedSpan.remove();
			}
		};

		var triggerScrolling = function (item) {
			item.classList.add('scroll-overflow');

			// Clone and append span
			var clone = item.firstElementChild.cloneNode(true);
			utils.requestAnimFrame.call(window, function ( ) {
				item.appendChild(clone);
			});
		};

		var items = target.querySelector('.cols').children;
		utils.forEach(items, function (index, item) {
			if (!item.classList.contains('overflow')) { return; }

			if (reset) {
				resetScrolling(item);
			} else if (!item.classList.contains('scroll-overflow')) {
				triggerScrolling(item);
			}
		});
	},

	showItemCover: function (target) {
		if (this.viewportWidth < 685 || !collection.getAllItems()) { return; }

		var parentNode = target.parentNode;
		var id = parentNode.getAttribute('data-id');

		var loadItemCover = function (item) {
			var format = item.format === 'MP4' || item.format === 'GIF' ? 'video' : 'img';
			var cdn = s.cdn + '/' + format + '/';
			var coverContainer = parentNode.querySelector('.cover');
			var cover = format === 'video' ? document.createElement(format) : new Image();

			function appendCover ( ) {
				cover.removeEventListener('canplay', appendCover);
				utils.requestAnimFrame.call(window, function ( ) {
					coverContainer.appendChild(cover);
					setTimeout(function ( ) {
						coverContainer.classList.add('cover-loaded');
					}, 10);
				});
			}

			cover.setAttribute('width', item.width);
			cover.setAttribute('height', item.height);
			cover.setAttribute('src', cdn + (item.format === 'GIF' ? item.video.filename : item.filename));

			if (format === 'video' || item.format === 'GIF') {
				cover.load();
				cover.play();
				cover.setAttribute('muted', '');
				cover.setAttribute('loop', true);
				cover.addEventListener('canplay', appendCover);
			} else {
				cover.setAttribute('alt', '');
				cover.onload = appendCover;
			}

			target.coverLoaded = true;
		};

		var randomCoverPosition = function (item) {
			var topPos = Math.floor(Math.random() * (-(item.height - 100) - (-30)) + (- 30));
			var margin = (4 / 100) * this.viewportWidth; // The number 4 here is the percentage
			var leftMin = margin;
			var leftMax = (this.viewportWidth - item.width) - margin;
			var leftPos = Math.floor(Math.random() * (leftMax - leftMin)) + leftMin;

			var coverContainer = target.parentNode.querySelector('[data-id="' + id + '"] .cover');
			coverContainer.style.cssText = coverContainer.style.cssText + 'top: ' + topPos +'px; left: ' + leftPos +'px';
		}.bind(this);

		var item = collection.getItem(id).covers[0];
		randomCoverPosition(item);
		target.coverLoaded || loadItemCover(item);
	},

	setupAudio: function ( ) {
		// Set initial (visual) volume state
		c.elems.volume.value = audio.getVolume() * 100;

		// Private variables
		var elem, currentProgress, progressBar, position, percent;

		pubsub.subscribe('audioLoading', function (id) {
			elem = c.elems.collection.querySelector('[data-id="' + id + '"]');
			var song = collection.getItem(id);
			var elemLink = elem.firstChild;

			// Unfocus previous item
			var prevElem = c.elems.currentItem;
			if (prevElem) {
				c.elems.currentItem = null;
				prevElem.firstChild.blur();
				utils.simulateEvent(prevElem.firstChild, 'mouseout');
			}

			// Load item cover & scroll overflowing text
			utils.simulateEvent(elem.firstChild, 'mouseover');

			// Add loading class
			c.elems.HTML.classList.add('loading-song');
			elem.classList.add('loading');

			// Update browser history (incl. document title)
			var href = elemLink.href;
			var documentTitle = utils.makeDocumentTitle([utils.structureArtists(song.artist, song.featuredartist), '"' + song.title + '"'], ', ') + ' – ' + config.settings.documentTitle;
			history.update(id, href, documentTitle);

			// Store element globally
			c.elems.currentItem = elem;

			// Scroll to track if out of bounds
			if (!utils.inViewport(elem, 250)) {
				utils.scrollToElement(elem);
			}
		}.bind(this));

		pubsub.subscribe('audioFailedLoading', function (id) {
			elem = c.elems.collection.querySelector('[data-id="' + id + '"]');
			c.elems.HTML.classList.remove('loading-song');
			elem.classList.remove('loading');
			elem.classList.add('unavailable');
		});

		pubsub.subscribe('audioPlaying', function (id) {
			var song = collection.getItem(id);
			var elemLink = elem.firstChild;

			c.elems.HTML.classList.remove('loading-song');
			elem.classList.remove('loading');
			elem.classList.add('playing');

			// Update document title with ▶ character
			var documentTitle = '▶ ' + document.title;
			history.updateDocumentTitle(documentTitle);

			// Insert duration element
			var time = elem.getElementsByClassName('col-time')[0];
			var firstChild = time.firstChild;
			currentProgress = document.createElement('span');
			utils.requestAnimFrame.call(window, function ( ) {
				currentProgress.innerHTML = '0:00';
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

			// Set global state
			c.elems.playStateBtn.classList.add('playing');
		});

		pubsub.subscribe('audioPaused', function (id) {
			elem.classList.remove('playing');
			elem.classList.add('paused');

			// Force progress bar to stop with a repaint (required on Mobile Safari)
			pubsub.publish('forceCollectionRepaint');

			// Update document title to remove ▶ character
			var documentTitle = document.title.replace('▶ ', '');
			history.updateDocumentTitle(documentTitle);

			// Set global state
			c.elems.playStateBtn.classList.remove('playing');
		});

		pubsub.subscribe('audioResumed', function (id) {
			elem.classList.remove('paused');
			elem.classList.add('playing');

			// Update document title with ▶ character
			var documentTitle = '▶ ' + document.title;
			history.updateDocumentTitle(documentTitle);

			// Scroll to track
			utils.scrollToElement(elem);

			// Set global state
			c.elems.playStateBtn.classList.add('playing');
		}.bind(this));

		pubsub.subscribe('audioStopped', function (id) {
			// Remove all classes
			c.elems.HTML.classList.remove('loading-song');
			elem.classList.remove('paused');
			elem.classList.remove('playing');
			elem.classList.remove('loading');

			// Remove DOM elements but first check if they are actually in the DOM, just in case
			if (utils.isInDOM(currentProgress)) {
				currentProgress.parentNode.removeChild(currentProgress);
				progressBar.parentNode.removeChild(progressBar);
			}

			// Update document title to remove ▶ character
			var documentTitle = document.title.replace('▶ ', '');
			history.updateDocumentTitle(documentTitle);

			// Set global state
			c.elems.playStateBtn.classList.remove('playing');
		});

		pubsub.subscribe('audioUpdating', function (args) {
			position = args[0];
			percent = args[1];

			utils.requestAnimFrame.call(window, function ( ) {
				currentProgress.textContent = utils.convertToReadableTime(position);
			});
		});

		pubsub.subscribe('historyChanged', function (id) {
			if (id) {
				audio.play(id);
			} else {
				audio.stop();
				utils.scrollToPosition(0, 400);
			}
		}.bind(this));

		var forceProgressRepaint = function ( ) {
			if (audio.getState() !== 'playing' && audio.getState() !== 'paused') { return; }

			// Give the browser some time catch up
			setTimeout(function ( ) {
				var currentSong = collection.getItem(audio.getCurrentId());
				var currentPercent = percent - 100;
				var timeLeft = currentSong.audio.duration - position;

				var clone = progressBar.cloneNode(true);
				progressBar.parentNode.replaceChild(clone, progressBar);

				['', 'webkit', 'moz'].forEach(function (vendor) {
					clone.style[vendor + 'Transform'] = 'translate3d(' + currentPercent +'%, 0, 0)';
					clone.style[vendor + 'AnimationDuration'] = timeLeft + 'ms';
					clone.style[vendor + 'AnimationName'] = 'progress-bar';
					clone.style[vendor + 'AnimationTimingFunction'] = 'linear';
					clone.style[vendor + 'AnimationFillMode'] = 'both';
				});

				progressBar = clone;
			}, 100);
		};

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
