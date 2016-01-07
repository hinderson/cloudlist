'use strict';

// Requires
var main = require('../main.js');
var pubsub = require('../pubsub.js');
var itemCover = require('../components/covers.js');

// TODO: Clean up this intro animation
setTimeout(function ( ) {
	main.cache.elems.collectionTitle.classList.add('animate');
}, 160);

var currentColor;
function stopped (id) {
	var elem = main.cache.elems.collection.querySelector('[data-id="' + id + '"]');
	elem.classList.remove(currentColor);
}

function loading (id) {
	// Add random palette color
	var elem = main.cache.elems.collection.querySelector('[data-id="' + id + '"]');
	currentColor = 'color-' + Math.floor(Math.random() * 8);
	elem.classList.add(currentColor);
}

function failedLoading (id) {
	var elem = main.cache.elems.collection.querySelector('[data-id="' + id + '"]');
	elem.classList.remove(currentColor);
}

function resizeEvent (width, height, prevWidth, prevHeight) {
	if (main.cache.elems.currentItem !== null) {
		var widthDiff = Math.abs(prevWidth - width);
		var heightDiff = Math.abs(prevHeight - height);

		// Only reflow/reposition element if the diff between
		// previous size and new is more than 40px
		if (widthDiff >= 40 || heightDiff >= 40) {
			itemCover.show(main.cache.elems.currentItem.firstChild);
		}
	}
}

main.init();

pubsub.subscribe('audioLoading', loading);
pubsub.subscribe('audioFailedLoading', failedLoading);
pubsub.subscribe('audioStopped', stopped);
pubsub.subscribe('itemMouseover', itemCover.show);
pubsub.subscribe('resize', resizeEvent);
