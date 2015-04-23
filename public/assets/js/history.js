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
					if (e.state === null) {
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
				if (window.history.state !== null && window.history.state.id === id) {
					documentTitle && this.updateDocumentTitle(documentTitle);
					return;
				}

				var song = Cloudlist.cache.collection.items[id] || null;
				if (song) {
					documentTitle && this.updateDocumentTitle(documentTitle);
					window.history.pushState({id: id, title: documentTitle || ''}, null, href || null);
				}
			},

			updateDocumentTitle: function (title, removeBaseTitle) {
				var updatedTitle = document.title = title + (!removeBaseTitle ? (' – ' + s.documentTitle) : '');
				if (window.history.state && window.history.state.id) {
					window.history.state.title = updatedTitle;
				}
			},

			resetDocumentTitle: function ( ) {
				document.title = s.documentTitle;
			}

		};
	}());
}());