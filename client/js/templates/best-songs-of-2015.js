'use strict';

// Requires
var main = require('../main.js');
var pubsub = require('../pubsub.js');
var audio = require('../audio.js');

// Template specific stuff
var stackBlur = require('../vendor/stackblur.js');

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
	var translateY3d = function (elem, value) {
		var translate = 'translate3d(0px,' + value + 'px, 0px)';
		elem.style['-webkit-transform'] = translate;
		elem.style.transform = translate;
	};

	var speedDivider = 6.7;
	var translateValue = lastScrollY / speedDivider;

	if (translateValue < 0) {
		translateValue = 0;
	}

	translateY3d(main.cache.elems.heroContent, translateValue);
};

var initCanvas = function ( ) {
	var collectionHero = document.querySelector('.collection-hero');
	var canvas = collectionHero.querySelector('canvas');
	var hero = collectionHero.querySelector('img');

	var cctx = canvas.getContext('2d');
	cctx.drawImage(hero, 0, 0);

	collectionHero.style.animation = 'none';
	collectionHero.style.opacity = 1;
	hero.style.opacity = 0;
	hero.style.visibility = 'hidden';

	return { collectionHero: collectionHero, canvas: canvas, hero: hero, cctx: cctx };
};

var canvas;
var windowLoaded = false;
window.onload = function ( ) {
	windowLoaded = true;
	canvas = initCanvas();
};

var blurHero = function (lastScrollY) {
	if (!windowLoaded) { return; }
	// canvas.collectionHero.style.opacity = (100 - (lastScrollY / 5)) / 100;
	canvas.cctx.drawImage(canvas.hero, 0, 0);
	stackBlur.canvasRGB(canvas.canvas, 0, 0, canvas.canvas.width, canvas.canvas.height, lastScrollY / 9);
};

var updateHero = function (lastScrollY) {
	// Bail if we've reached the collection
	if (lastScrollY > main.cache.collectionTop) {
		return;
	}

	updateParallax(lastScrollY);
	blurHero(lastScrollY);
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

pubsub.subscribe('scrolling', updateHero);
pubsub.subscribe('audioPlaying', playing);
pubsub.subscribe('audioPaused', stopped);
pubsub.subscribe('audioStopped', stopped);
pubsub.subscribe('audioResumed', playing);
