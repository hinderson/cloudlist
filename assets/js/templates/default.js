'use strict';

// Requires
var main = require('../main.js');
var utils = require('../utils.js');
var pubsub = require('../pubsub.js');
var audio = require('../audio.js');
var collection = require('../data/collection.js');
var covers = require('../components/random-covers.js');
var fullscreen = require('../components/fullscreen.js')(document.getElementsByClassName('fullscreen')[0]);
var volume = require('../components/volume.js')(document.getElementsByClassName('volume-slider')[0]);
var dialog = require('../components/dialog.js')(document.getElementsByClassName('info-toggle')[0]);

var elems = {
	heroContent: document.getElementsByClassName('hero-inner')[0],
	goToTop: document.getElementsByClassName('go-to-top')[0],
};

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

	translateY3d(elems.heroContent, translateValue);
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

function showItemCover (target) {
	if (main.viewportWidth < 685 ||
		!collection.getAllItems() ||
		target.parentNode.classList.contains('playing') ||
		target.parentNode.classList.contains('paused') ||
		target.parentNode.classList.contains('loading')
	) { return; }

	covers.show(target);
}

main.init();

// Event messages
pubsub.subscribe('scrolling', updateParallax);
pubsub.subscribe('itemMouseover', showItemCover);
pubsub.subscribe('audioLoading', loading);
pubsub.subscribe('audioFailedLoading', failedLoading);
pubsub.subscribe('audioStopped', stopped);

// Events
elems.goToTop.addEventListener('click', function (e) {
	utils.scrollToPosition(0, 400);
	e.preventDefault();
});
