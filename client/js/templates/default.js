'use strict';

// Requires
var main = require('../main.js');
var pubsub = require('../pubsub.js');
var audio = require('../audio.js');

var cacheElems = function ( ) {
	// Extends to main cache object
	main.cache.elems.playBtn = document.querySelector('.hero button');
};

var registerEvents = function ( ) {
	main.cache.elems.playBtn.addEventListener('click', function (e) {
		// Play first song in collection
		audio.toggleState();
	}, false);
};

var updateParallax = function (lastScrollY) {
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
};

var playing = function ( ) {
	main.cache.elems.playBtn.classList.add('playing');
};

var stopped = function ( ) {
	main.cache.elems.playBtn.classList.remove('playing');
};

cacheElems();
registerEvents();
main.init();

pubsub.subscribe('scrolling', updateParallax);
pubsub.subscribe('audioPlaying', playing);
pubsub.subscribe('audioPaused', stopped);
pubsub.subscribe('audioStopped', stopped);
pubsub.subscribe('audioResumed', playing);

// TEMP: Test opacity change on header
/*
pubsub.subscribe('scrolling', function (lastScrollY) {
	var distance = Cloudlist.getViewportDimensions().height * 1.7;
	c.elems.heroImage.style.webkitAnimationFillMode = 'backwards';
	c.elems.heroImage.style.opacity = Math.max((1 - lastScrollY/distance), 0);
});
*/
