'use strict';

// Requires
var main = require('../main.js');
var pubsub = require('../pubsub.js');
var audio = require('../audio.js');
var itemCover = require('../components/covers.js');

function cacheElems ( ) {
	// Extends to main cache object
	main.cache.elems.playBtn = document.querySelector('.hero button');
}

function registerEvents ( ) {
	main.cache.elems.playBtn.addEventListener('click', function (e) {
		// Play first song in collection
		audio.toggleState();
	}, false);
}

function updateParallax (lastScrollY) {
	// Bail if we've reached the collection
	if (lastScrollY > main.cache.collectionTop) {
		return;
	}

	var translateY3d = function (elem, value) {
		var translate = 'translate3d(0px,' + value + 'px, 0px)';
		elem.style['-webkit-transform'] = translate;
		elem.style.transform = translate;
	};

	var speedDivider = 10;
	var translateValue = lastScrollY / speedDivider;

	if (translateValue < 0) {
		translateValue = 0;
	}

	translateY3d(main.cache.elems.heroContent, translateValue);
}

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

cacheElems();
registerEvents();
main.init();

pubsub.subscribe('scrolling', updateParallax);
pubsub.subscribe('audioLoading', loading);
pubsub.subscribe('audioFailedLoading', failedLoading);
pubsub.subscribe('audioStopped', stopped);
pubsub.subscribe('itemMouseover', itemCover.show);
pubsub.subscribe('resize', resizeEvent);
