'use strict';

// Requires
var main = require('../main.js');
var pubsub = require('../pubsub.js');
var audio = require('../audio.js');
var collection = require('../data/collection.js');
var config = require('../config.js');
var placeholders = require('../placeholders.js');

// Extend config
config.api.version = 'v1';

// Template specific stuff
var stackBlur = require('../vendor/stackblur.js');

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
}

function initCanvas ( ) {
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
}

var canvas;
var windowLoaded = false;
window.addEventListener('load', function ( ) {
	windowLoaded = true;
	canvas = initCanvas();
});

function blurHero (lastScrollY) {
	if (!windowLoaded) { return; }
	// canvas.collectionHero.style.opacity = (100 - (lastScrollY / 5)) / 100;
	canvas.cctx.drawImage(canvas.hero, 0, 0);
	stackBlur.canvasRGB(canvas.canvas, 0, 0, canvas.canvas.width, canvas.canvas.height, lastScrollY / 9);
}

function updateHero (lastScrollY) {
	// Bail if we've reached the collection
	if (lastScrollY > main.cache.collectionTop) {
		return;
	}

	updateParallax(lastScrollY);
	blurHero(lastScrollY);
}

function loading (id) {
	// Add assigned color based on first associated cover
	var elemLink = main.cache.elems.collection.querySelector('[data-id="' + id + '"] a');
	var rgb = collection.getItem(id).covers[0].colors.primary;
	elemLink.style.background = 'rgba(' + rgb + ', 0.85)';

	// Change background color
	var contrastOpacity = collection.getItem(id).covers[0].colors.contrast === 'dark' ? 0.53 : 0.85;
	main.cache.elems.body.style.background = 'rgba(' + rgb + ', ' + contrastOpacity + ')';
}

function paused (id) {
	// Change opacity of cover color
	var elemLink = main.cache.elems.collection.querySelector('[data-id="' + id + '"] a');
	var rgb = collection.getItem(id).covers[0].colors.primary;
	elemLink.style.background = 'rgba(' + rgb + ', 0.45)';
}

function resume (id) {
	// Add assigned color based on first associated cover
	var elemLink = main.cache.elems.collection.querySelector('[data-id="' + id + '"] a');
	var rgb = collection.getItem(id).covers[0].colors.primary;
	elemLink.style.background = 'rgba(' + rgb + ', 0.85)';
}

function stopped (id) {
	var elemLink = main.cache.elems.collection.querySelector('[data-id="' + id + '"] a');
	elemLink.removeAttribute('style');
}

main.init();
cacheElems();
registerEvents();
placeholders.lazyLoad();

pubsub.subscribe('scrolling', updateHero);
pubsub.subscribe('audioLoading', loading);
pubsub.subscribe('audioPaused', paused);
pubsub.subscribe('audioStopped', stopped);
pubsub.subscribe('audioResumed', resume);
