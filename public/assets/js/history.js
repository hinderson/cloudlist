/*jslint browser: true */
/*global SoundManager, Cloudlist, convertToReadableTime */

;(function () {
	'use strict';

	Cloudlist.history = (function () {
		var s; // Private aliases: settings

		return {

			init: function ( ) {
				this.core = Cloudlist;
				s = this.core.settings;
				this.listen();
			},

			listen: function ( ) {
				var checkState = function (e) {
					console.log('Current state:', e.state);
					if (e.state === null) {
						/*
						this.resetDocumentTitle();
						this.core.audio.stopAll();
						*/
						window.location.reload(true);
					} else {
						this.updateDocumentTitle(window.history.state.title);
						this.core.audio.play(window.history.state.id);
					}
				}.bind(this);

				// The small time-out makes Safari ignore initial popstate, which it should do according to spec
				setTimeout( function() {
					window.addEventListener('popstate', checkState, false);
				}, 500);
			},

			update: function (id, href, documentTitle) {
				var song = Cloudlist.cache.collection.items[id] || null;

				if (song) {
					if (window.history.state !== null && window.history.state.id === id) {
						return;
					}

					documentTitle && this.updateDocumentTitle(documentTitle);
					window.history.pushState({id: id, title: documentTitle || ''}, null, href || null);
				}
			},

			updateDocumentTitle: function (title, removeBaseTitle) {
				document.title = title + (!removeBaseTitle ? (' – ' + s.documentTitle) : '');
				if (window.history.state) {
					window.history.replaceState({id: window.history.state.idid, title: title});
				}
			},

			resetDocumentTitle: function ( ) {
				document.title = s.documentTitle;
			}

		};
	}());
}());