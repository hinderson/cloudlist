'use strict';

// Requires
var config = require('./config.js');
var pubsub = require('./pubsub.js');

module.exports = {

	init: function (cb) {
		// Listens for changes/updates
		var checkState = function (e) {
			if (e.state === null) {
				window.location.reload(true);
				pubsub.publish('historyChanged');
			} else {
				this.updateDocumentTitle(window.history.state.title);
				pubsub.publish('historyChanged', window.history.state.id);
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

		documentTitle && this.updateDocumentTitle(documentTitle);
		window.history.pushState({id: id, title: documentTitle || ''}, null, href || null);
	},

	updateDocumentTitle: function (title, removeBaseTitle) {
		document.title = title + (!removeBaseTitle ? (' – ' + config.settings.documentTitle) : '');
		if (window.history.state && window.history.state.id) {
			window.history.state.title = title;
		}
	},

	resetDocumentTitle: function ( ) {
		document.title = config.settings.documentTitle;
	}

};