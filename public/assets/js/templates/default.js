/*jslint browser: true */
/*global */

;(function () {
	'use strict';

	Cloudlist.templateDefault = (function () {
		var s, c; // Private aliases: settings and cache

		return {

			init: function ( ) {
				this.core = Cloudlist;
				s = this.core.settings;
				c = this.core.cache;

				this.cacheElems();
				this.registerEvents();

				pubsub.subscribe('scrolling', this.updateParallax);
			},

			cacheElems: function ( ) {
				// Extends to main cache object
				c.elems.playBtn = document.querySelector('.hero button');
			},

			registerEvents: function ( ) {
				c.elems.playBtn.addEventListener('click', function (e) {
					// Play first song in collection
					var id = c.collection.order[0];
					this.core.audio.play(id);
				}.bind(this), false);
			},

			updateParallax: function (lastScrollY) {
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

		};
	}());
}());