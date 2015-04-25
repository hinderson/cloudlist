/*jslint browser: true */
/*global SoundManager, Cloudlist */

;(function () {
	'use strict';

	// Namespace
	var Cloudlist = Cloudlist || { };

	Cloudlist = (function () {
		var s, c; // Private aliases: settings, cache
		var ticking = false, lastScrollY = 0; // Private variables

		// Private functions
		var itemClickHandler = function (e) {
			e.preventDefault();

			var id = e.delegateTarget.parentNode.getAttribute('data-id');
			Cloudlist.audio.toggle(id);
		};

		var itemHoverHandler = function (e) {
			var target = e.delegateTarget;

			switch (e.type) {
				case 'mouseover':
					Cloudlist.loadItemCover(target);
					Cloudlist.scrollOverflowingText(target);
					break;
				case 'mouseout':
					Cloudlist.scrollOverflowingText(target, true);
					break;
			}
		};

		var sortClickHandler = function (e) {
			e.preventDefault();

			var target = e.target;
			var targetContent = target.textContent;
			var sortDirection = target.className;
			var type = target.parentNode.getAttribute('data-sort-type');

			// First remove previous <strong> tag
			var strong = this.getElementsByTagName('strong')[0];
			if (strong && strong !== target) {
				var span = document.createElement('span');
				span.innerHTML = strong.textContent;
				strong.parentNode.insertBefore(span, strong);
				strong.parentNode.removeChild(strong);
			}

			// Actually sort the collection
			Cloudlist.sortCollection({
				sortBy: type,
				isNum: (type === 'index' || type === 'time' ? true : false),
				order: (sortDirection === 'asc' ? 'desc' : 'asc')
			});

			// Create new <strong> and replace it with the previous tag
			var newStrong = document.createElement('strong');
			newStrong.textContent = targetContent;

			if (sortDirection === 'asc') {
				newStrong.classList.remove('asc');
				newStrong.classList.add('desc');

				var desc = Helper.createSVGFragment('icon-caret-desc', '0 0 586.666 293.333');
				newStrong.appendChild(desc);
			} else {
				newStrong.classList.remove('desc');
				newStrong.classList.add('asc');

				var asc = Helper.createSVGFragment('icon-caret-asc', '0 0 612 306');
				newStrong.appendChild(asc);
			}

			target.parentNode.appendChild(newStrong);
			target.parentNode.removeChild(target);
		};

		var getCollection = function () {
			// Store GET request, structure and store it in global array
			var XMLHttp = new XMLHttpRequest();

			XMLHttp.open('GET', '/song-collection/', true);
			XMLHttp.onreadystatechange = function ( ) {
				if (XMLHttp.readyState === 4) {
					if (XMLHttp.status === 200) {
						var response = JSON.parse(XMLHttp.responseText);

						// Set document title
						s.documentTitle = response.collection.title + ' – Cloudlist.io';

						// Expose the collection
						c.collection = response.collection;
						c.collection.items = response.items;
						c.collection.order = response.order;
						c.collection.index = response.order.slice();
					}
				}
			};
			XMLHttp.send(null);
		};

		return {
			settings: {
				debug: false,
				lang: document.documentElement.lang,
				cdn: 'https://static.cloudlist.io',
				documentTitle: '',
				maxItems: 100
			},

			cache: {
				collection: {
					index: [], // This stores the actual index positions
					order: [], // This stores the current, updatable sort order
					items: {}
				},
				elems: {
					HTML: document.getElementsByTagName('html')[0],
					heroContent: document.getElementsByClassName('hero-inner')[0],
					collectionHeader: document.getElementsByClassName('collection-header')[0],
					collectionTitle: document.getElementsByClassName('collection-title')[0],
					collectionSubTitle: document.getElementsByClassName('collection-sub-title')[0],
					collection: document.getElementsByClassName('collection')[0],
					scrollableOverflowElems: document.querySelectorAll('.artist, .title'),
					sort: document.getElementsByClassName('sort')[0],
					closeDialog: document.getElementsByClassName('close-dialog')[0],
					dialogOverlay: document.getElementsByClassName('dialog-overlay')[0],
					infoBtn: document.getElementsByClassName('info-toggle')[0],
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
				collectionTop: Helper.getElemDistanceFromDoc(document.getElementsByClassName('collection')[0]).top
			},

			init: function ( ) {
				s = this.settings;
				c = this.cache;
				getCollection();
				this.registerEvents();
				this.registerKeyboardEvents();
				this.findOverflowingElements();
				this.storeViewportDimensions();

				// TODO: Clean up this intro animation
				setTimeout(function ( ) {
					c.elems.collectionTitle.classList.add('animate');
				}, 150);
			},

			registerEvents: function ( ) {
				c.elems.collection.addEventListener('click', Helper.delegate(Helper.criteria.hasTagName('a'), itemClickHandler), false);

				c.elems.collection.addEventListener('mouseover', Helper.delegate(Helper.criteria.hasTagName('a'), itemHoverHandler), false);

				c.elems.collection.addEventListener('mouseout', Helper.delegate(Helper.criteria.hasTagName('a'), itemHoverHandler), false);

				c.elems.sort.addEventListener('click', Helper.delegate(Helper.criteria.hasTagNames(['span', 'strong']), sortClickHandler), false);

				c.elems.fullscreen.addEventListener('click', this.toggleFullscreen, false);

				c.elems.infoBtn.addEventListener('click', this.toggleDialog, false);

				c.elems.dialogOverlay.addEventListener('click', function ( ) {
					c.elems.HTML.classList.remove('overlay');
				}, false);

				c.elems.closeDialog.addEventListener('click', function ( ) {
					c.elems.HTML.classList.remove('overlay');
				}, false);

				c.elems.volume.addEventListener('input', function (e) {
					this.audio.setVolume(e.target.value);
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
			},

			detachEvents: function (e) {
				var temp;
				var evt;
				for (var i = 0; i < this._events.length; i++) {
					evt = this._events[i];
					if (!e) {
						//Handler.off(evt.target, evt.eventname, evt.listener);
					} else if (e && evt.target === e.currentTarget) {
						//Handler.off(evt.target, evt.eventname, evt.listener);
						break;
					}
				}
			},

			storeViewportDimensions: function ( ) {
				this.viewportWidth = window.innerWidth;
				this.viewportHeight = window.innerHeight;
			},

			storeMousePosition: Helper.debounce(function (x, y) {
				c.mousePosition = {
					x: x,
					y: y
				}
			}, 150),

			scrollEvent: function ( ) {
				lastScrollY = window.pageYOffset;

				var requestTick = function ( ) {
					this.updateParallax();
					this.throttleHoverStates();

					// Add sticky-header class
					if (this.viewportWidth > 600) {
						if (lastScrollY > c.collectionTop) {
							c.elems.HTML.classList.add('sticky-header');
						} else {
							c.elems.HTML.classList.remove('sticky-header');
						}
					}

					// Re-focus on currently playing track
					window.clearTimeout(this.focusInterval);
					this.focusInterval = window.setTimeout(function ( ) {
						var elem = c.elems.currentItem;
						if (elem && !Helper.inViewport(elem, 250) && this.audio.state.audio === 'playing') {
							this.scrollToElement(elem);
						} else {
							window.clearTimeout(this.focusInterval);
						}
					}.bind(this), 6000);

					// Stop ticking
					ticking = false;
				};

				if (!ticking) {
					Helper.requestAnimFrame.call(window, requestTick.bind(this));
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

			resizeEvent: Helper.debounce(function ( ) {
				this.storeViewportDimensions();

				// Find overflowing elements and determine animation duration based on elem width
				this.findOverflowingElements();

				// Update position of collection top
				c.collectionTop = Helper.getElemDistanceFromDoc(c.elems.collection).top;
			}, 250),

			updateParallax: function ( ) {
				// Bail if we've reached the collection
				if (lastScrollY > c.collectionTop) {
					return;
				}

				var translateY3d = function (elem, value) {
					var translate = 'translate3d(0px,' + value + 'px, 0px)';
					elem.style['-webkit-transform'] = translate;
					elem.style['-moz-transform'] = translate;
					elem.style['-ms-transform'] = translate;
					elem.style['-o-transform'] = translate;
					elem.style.transform = translate;
				};

				var speedDivider = 10;
				var translateValue = lastScrollY / speedDivider;

				if (translateValue < 0) {
					translateValue = 0;
				}

				translateY3d(c.elems.heroContent, translateValue);
			},

			findOverflowingElements: function ( ) {
				var elems = c.elems.scrollableOverflowElems;
				Helper.forEach(elems, function (index, item) {
					if (Helper.isOverflowed(item)) {
						// Calculate animation duration based on character count
						var animDuration = item.textContent.length * 0.35;

						Helper.forEach(item.children, function (index, span) {
							Helper.requestAnimFrame.call(window, function ( ) {
								span.style[Helper.vendorPrefix().js + 'AnimationDuration'] =   animDuration + 's';
							});
						});

						item.classList.add('overflow');
					} else {
						item.classList.remove('overflow');
					}
				});
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
							this.audio.toggle();
							break;

						// Left & up arrow
						case 38:
						case 37:
							e.preventDefault();
							console.log('Left arrow');
							this.audio.previous();
							break;

						// Right & down arrow
						case 39:
						case 40:
							e.preventDefault();
							console.log('Right or down arrow');
							this.audio.next();
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
							this.audio.toggleMute();
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

			sortCollection: function (options) {
				var items = []; // Store all items that need to be sorted here
				var order = c.collection.order;
				var songs = c.collection.items;
				var collection = c.elems.collection.children[2];
				var collectionItems = collection.querySelectorAll('li');

				var sortNum = function (a, b) {
					return a.sortBy - b.sortBy;
				};
				var sortKey = function (a, b) {
					if (a.sortBy > b.sortBy) {
						return 1;
					}
					if (a.sortBy < b.sortBy) {
						return -1;
					}

					return 0;
				};

				for (var i = 0, len = order.length; i < len; i++) {
					var id = order[i];

					switch (options.sortBy) {
						case 'index':
						items.push({index: i, id: id, sortBy: c.collection.index.indexOf(id)});
						break;

						case 'title':
						items.push({index: i, id: id, sortBy: songs[id].title});
						break;

						case 'artist':
						items.push({index: i, id: id, sortBy: songs[id].artist});
						break;

						case 'time':
						items.push({index: i, id: id, sortBy: Math.round(songs[id].audio.duration)});
						break;
					}

					collection.removeChild(collectionItems[i]);
				}

				if (options.isNum) {
					items.sort(sortNum);
				} else {
					items.sort(sortKey);
				}

				if (options.order === 'desc') {
					if (options.isNum) {
						items.reverse(sortNum);
					} else {
						items.reverse(sortKey);
					}
				}

				order.length = 0;
				for (var i = 0, len = items.length; i < len; i++) {
					var id = items[i].id;
					var index = items[i].index;
					order.push(id);
					collection.appendChild(collectionItems[index]);
				}
			},

			scrollOverflowingText: function (target, reset) {
				// Bounce – i.e. don't reset or retrigger any values – if current item is already playing/is paused
				if (target.parentNode === c.elems.currentItem) {
					return;
				}

				var items = target.children;
				Helper.forEach(items, function (index, item) {
					if (item.classList.contains('overflow')) {
						if (!reset) {
							item.classList.add('scroll-overflow');

							// Clone and append span
							this.clone = item.firstElementChild.cloneNode(true);
							item.appendChild(this.clone);
						} else {
							item.classList.remove('scroll-overflow');

							// Remove cloned span
							this.clone && this.clone.remove();
						}
					}

				}.bind(this));
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
					var runTime;

					startTime || (startTime = time);
					runTime = time - startTime;

					if (duration > runTime) {
						Helper.requestAnimFrame.call(window, loop);
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

				Helper.requestAnimFrame.call(window, loop);
			},

			scrollToElement: function (element) {
				var rect = element.getBoundingClientRect();
				var offsetTop = rect.top + lastScrollY;
				var elementHeight = rect.height;
				var offset = (this.viewportHeight / 2) - (elementHeight / 2);

				this.scrollToPosition(offsetTop - offset, 500);
			},

			loadItemCover: function (target) {
				var parentNode = target.parentNode;
				var id = parentNode.getAttribute('data-id');

				if (this.viewportWidth < 685) {
					return;
				}

				if (c.coversLoaded.indexOf(id) === -1) {
					var item = c.collection.items[id].covers[0];
					var format = (item.format === 'MP4' && Helper.canPlayMP4()) ? 'video' : 'img';
					var cdn = s.cdn + '/media/' + format + '/';
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

					parentNode.appendChild(cover);
					c.coversLoaded.push(id);

					this.randomCoverPosition(id, cover);
				} else if (!(parentNode.classList.contains('playing') || parentNode.classList.contains('paused'))) { // Reposition again if cover has already been loaded
					this.randomCoverPosition(id);
				}
			},

			randomCoverPosition: function (id, cover) {
				var item = c.collection.items[id].covers[0];
				var cover = cover || document.querySelector('[data-id="' + id + '"] .cover');

				var topPos = Math.floor(Math.random() * (-(item.height - 100) - (-30)) + (- 30));
				var margin = (4 / 100) * this.viewportWidth; // The number 3 here is the percentage
				var leftMin = margin;
				var leftMax = (this.viewportWidth - item.width) - margin;
				var leftPos = Math.floor(Math.random() * (leftMax - leftMin)) + leftMin;

				Helper.requestAnimFrame.call(window, function ( ) {
					cover.style.cssText = 'top: ' + topPos +'px; left: ' + leftPos +'px';
				});
			}

		};
	}());

	// Expose access to the constructor
	window.Cloudlist = Cloudlist;

}());