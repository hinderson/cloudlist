/*jslint browser: true */
/*global  */

;(function () {
	'use strict';

	// Namespace
	var Helper = Helper || { };

	Helper = (function () {

		return {
			delegate: function (criteria, listener) {
				return function (e) {
					var el = e.target;
					do {
						if (!criteria(el)) continue;
						e.delegateTarget = el;
						listener.apply(this, arguments);
						return;
					} while( (el = el.parentNode) );
				};
			},

			partialDelegate: function (criteria) {
				return function (handler) {
					return Helper.delegate(criteria, handler);
				};
			},

			criteria: {
				isAnElement: function (e) {
					return e instanceof HTMLElement;
				},
				hasClass: function (cls) {
					return function (e) {
						return Helper.criteria.isAnElement(e) && e.classList.contains(cls);
					};
				},
				hasTagName: function (tag) {
					return function (e) {
						return Helper.criteria.isAnElement(e) && e.nodeName === tag.toUpperCase();
					};
				},
				hasTagNames: function (tags) {
					if (tags.length > 0) {
						return function (e) {
							for (var i = 0, len = tags.length; i < len; i++) {
								if (Helper.criteria.isAnElement(e) && e.nodeName === tags[i].toUpperCase()) {
									return Helper.criteria.isAnElement(e) && e.nodeName === tags[i].toUpperCase();
								}
							}
						};
					}
				}
			},

			vendorPrefix: function ( ) {
				var styles = window.getComputedStyle(document.documentElement, ''),
					pre = (Array.prototype.slice
						.call(styles)
						.join('')
						.match(/-(moz|webkit|ms)-/) || (styles.OLink === '' && ['', 'o'])
					)[1],
					dom = ('WebKit|Moz|MS|O').match(new RegExp('(' + pre + ')', 'i'))[1];
				return {
					dom: dom,
					lowercase: pre,
					css: '-' + pre + '-',
					js: pre[0].toUpperCase() + pre.substr(1)
				};
			},

			addClass: function (element, name) {
				if (!Helper.hasClass(element, name)) {
					var className = element.className;
					className += ' ' + name;
					element.className = className.trim();
				}
			},

			removeClass: function (element, name) {
				var className = element.className;
				var pattern = new RegExp('(?:^|\\s)' + name + '(?!\\S)', 'g');

				className = className.replace(pattern, '');
				elem.className = className.trim();
			},

			hasClass: function (element, name) {
				var className = element.className;
				var pattern = new RegExp('(?:^|\\s)' + name + '(?!\\S)', 'g');
				return pattern.test(className);
			},

			toggleClass: function (element, name) {
				if (Helper.hasClass(element, name)) {
					Helper.removeClass(element, name);
				} else {
					Helper.addClass(element, name);
				}
			},

			debounce: function (func, wait, immediate) {
				var timeout;
				return function() {
					var context = this, args = arguments;
					var later = function() {
						timeout = null;
						if (!immediate) func.apply(context, args);
					};
					var callNow = immediate && !timeout;
					clearTimeout(timeout);
					timeout = window.setTimeout(later, wait);
					if (callNow) func.apply(context, args);
				};
			},

			requestAnimFrame: (
				window.requestAnimationFrame        ||
				window.webkitRequestAnimationFrame  ||
				window.mozRequestAnimationFrame     ||
				window.oRequestAnimationFrame       ||
				window.msRequestAnimationFrame      ||
				function (callback) {
					window.setTimeout(callback, 1000 / 60);
				}
			),

			convertToReadableTime: function (position) {
				var seconds = Math.floor((position / 1000) % 60),
					minutes = Math.floor((position / (60 * 1000)) % 60);
				return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
			},

			makeDocumentTitle: function (args, separator) {
				return args.join(separator);
			},

			structureArtists: function (artist, featured, separator) {
				separator = separator || ' feat. ';
				artist = Array.isArray(artist) && artist.length > 1 ? artist.slice(0, -1).join(', ') + ' & ' + artist[artist.length -1] : artist;
				featured = Array.isArray(featured) && featured.length > 1 ? featured.slice(0, -1).join(', ') + ' & ' + featured[featured.length -1] : featured;
				featured = featured && featured.length > 0 ? (separator + featured) : '';

				var artists = artist + featured;
				return artists;
			},

			structureSlugs: function (slugs) {
				return '/artist/' + slugs.artist + '/track/' + slugs.title + '/';
			},

			moveToBackOfArray: function (element, array) {
				var index = array.indexOf(element);
				if (index !== -1) {
					array.splice(index, 1);
					array.push(element);
				}
			},

			replaceTag: function (tag, replacement) {

			},

			getScrollingElement: function ( ) {
				return	document.documentElement.scrollHeight > document.body.scrollHeight &&
						document.compatMode.indexOf('CSS1') === 0 ?
						document.documentElement :
						document.body;
			},

			inViewport: function (element, offset) {
				var rect = element.getBoundingClientRect();
				var doc = Helper.getScrollingElement();

				offset = offset || 0;

				return	(rect.bottom - offset) > 0 &&
						rect.right > 0 &&
						rect.left < (window.innerWidth || doc.clientWidth) &&
						rect.top < (window.innerHeight || doc.clientHeight) - offset;
			},

			isOverflowed: function (element) {
				var rect = element.getBoundingClientRect();
				return element.scrollWidth > rect.width;
			},

			simulateMouseEvent: function (node, eventType) {

				var event;
				try {
					// DOM Level 3
					event = new MouseEvent(eventType, {
						'view': window,
						'bubbles': true,
						'cancelable': true
					});

					node.dispatchEvent(event);
				}
				catch (err) {
					if (document.createEvent) {
						// DOM Level 2
						event = document.createEvent('MouseEvents');
						event.initMouseEvent(eventType, true, true, window, null, 0, 0, 0, 0, '', false, false, false, false, 0, previousNode);

						node.dispatchEvent(event);
					} else {
						// IE8 and below
						event = document.createEventObject();
						event.relatedTarget = previousNode;

						node.fireEvent(eventType, event);
					}
				}
			},

			createSVGFragment: function (name, viewBox) {
				var container = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
				container.setAttribute('viewBox', viewBox);

				var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
				use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + name);

				container.appendChild(use);

				return container;
			},

			updateSVGFragment: function (container, name, viewBox) {
				var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
				use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + name);

				if (viewBox) {
					container.setAttribute('viewBox', viewBox);
				}

				// First remove all child elements of container
				while (container.firstChild) {
					container.removeChild(container.firstChild);
				}
				container.appendChild(use);

				return container;
			},

			getTextNodes: function (node) {
				var childTextNodes = [];

				if (!node.hasChildNodes()) {
					return;
				}

				var childNodes = node.childNodes;
				for (var i = 0; i < childNodes.length; i++) {
					if (childNodes[i].nodeType == Node.TEXT_NODE) {
						childTextNodes.push(childNodes[i]);
					} else if (childNodes[i].nodeType == Node.ELEMENT_NODE) {
						Array.prototype.push.apply(childTextNodes, getTextNodes(childNodes[i]));
					}
				}

				return childTextNodes;
			},

			wrapEachCharacter: function (textNode, tag) {
				var text = textNode.nodeValue;
				var parent = textNode.parentNode;

				var characters = text.split('');
				var elements = [];
				characters.forEach(function(character) {
					var element = document.createElement(tag);
					var characterNode = document.createTextNode(character);
					element.appendChild(characterNode);

					parent.insertBefore(element, textNode);
				});

				parent.removeChild(textNode);
			},

			canPlayMP4: function ( ) {
				var v = document.createElement('video');
				if (v.canPlayType && v.canPlayType('video/mp4').replace(/no/, '')) {
					return true;
				} else {
					return false;
				}
			}

		};

	}());

	// Expose access to the constructor
	window.Helper = Helper;

}());