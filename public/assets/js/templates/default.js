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
			},

			cacheElems: function ( ) {
				c.elems.playBtn = document.querySelector('.hero button');
			},

			registerEvents: function ( ) {
				c.elems.playBtn.addEventListener('click', function (e) {
					// Play first song in collection
					var id = c.collection.order[0];
					this.core.audio.play(id);
				}.bind(this), false);
			},

		};
	}());
}());