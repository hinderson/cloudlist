'use strict';

// Requires
var main = require('../main.js');
var utils = require('../utils.js');
var pubsub = require('../pubsub.js');
var collection = require('../data/collection.js');
var covers = require('../components/random-covers.js');
var fullscreen = require('../components/fullscreen.js')(document.getElementsByClassName('fullscreen')[0]);
var volume = require('../components/volume.js')(document.getElementsByClassName('volume-slider')[0]);
var dialog = require('../components/dialog.js')(document.getElementsByClassName('info-toggle')[0]);

var elems = {
	goToTop: document.getElementsByClassName('go-to-top')[0],
};

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

function showItemCover (target) {
	if (main.viewportWidth < 685 ||
		!collection.getAllItems() ||
		target.parentNode.classList.contains('playing') ||
		target.parentNode.classList.contains('paused') ||
		target.parentNode.classList.contains('loading')
	) { return; }

	covers.show(target);
}

pubsub.subscribe('itemMouseover', showItemCover);
pubsub.subscribe('audioLoading', loading);
pubsub.subscribe('audioFailedLoading', failedLoading);
pubsub.subscribe('audioStopped', stopped);

// Register events
elems.goToTop.addEventListener('click', function (e) {
	utils.scrollToPosition(0, 400);
	e.preventDefault();
});

main.init();
