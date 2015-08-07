'use strict';

// Requires
var config = require('./config.js');
var pubsub = require('./pubsub.js');

module.exports = {

	init: function (cb) {
		// Listens for changes/updates
		var checkState = function (e) {
			if (e.state === null) {
				this.resetDocumentTitle();
				pubsub.publish('historyChanged');
			} else {
				this.updateDocumentTitle(window.history.state.title);
				pubsub.publish('historyChanged', window.history.state.id);
			}
		}.bind(this);

		// This 0 ms time-out makes Safari ignore initial popstate, which it should do according to spec
		window.addEventListener('load', function ( ) {
			setTimeout(function ( ) {
				window.addEventListener('popstate', checkState, false);
			}, 0);
       }, false);
	},

	update: function (id, href, documentTitle) {
		var state = {id: id, title: documentTitle || ''};
		if (href === window.location.href) {
			window.history.replaceState(state, null, href);
		} else {
			window.history.pushState(state, null, href);
		}
		documentTitle && this.updateDocumentTitle(documentTitle);
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
