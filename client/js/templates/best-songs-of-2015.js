'use strict';

// Requires
var main = require('../main.js');
var pubsub = require('../pubsub.js');
var collection = require('../data/collection.js');
var config = require('../config.js');
var utils = require('../utils.js');
var placeholders = require('../placeholders.js');

// Extend config
config.api.version = 'v1';

// Template specific stuff
function cacheElems ( ) {
	// Extends to main cache object
	main.cache.elems.playBtn = document.querySelector('.hero button');
}

function registerEvents ( ) {

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

var windowLoaded = false;
window.addEventListener('load', function ( ) {
	windowLoaded = true;
});

function updateHero (lastScrollY) {
	// Bail if we've reached the collection
	if (lastScrollY > main.cache.collectionTop) {
		return;
	}

	updateParallax(lastScrollY);
}

function loading (id) {
	// Add assigned color based on first associated cover
	var cover = collection.getItem(id).covers[0];
	var elemLink = main.cache.elems.collection.querySelector('[data-id="' + id + '"] a');
	var rgb = cover.colors.primary;
	elemLink.style.background = 'rgba(' + rgb + ', 0.85)';

	// Change background color
	var lighterColor = utils.shadeRGBColor(rgb.toString(), cover.colors.contrast === 'dark' ? 0.37 : 0.1);
	main.cache.elems.body.style.backgroundColor = 'rgb(' + lighterColor + ')';

	var gradient = document.createElement('DIV');
	gradient.className = 'gradient';
	gradient.style.backgroundImage = 'linear-gradient(to bottom, rgba(' + lighterColor + ', 0.97) 0%, rgba(' + lighterColor + ', 0.85) 65%, rgba(' + lighterColor + ', 0.02) 100%)';
	main.cache.elems.headerShadow.appendChild(gradient);
	setTimeout(function ( ) {
		main.cache.elems.headerShadow.classList.add('transition');
	});

	main.cache.elems.headerShadow.addEventListener('transitionend', function onTransitionEnd ( ) {
		main.cache.elems.headerShadow.removeEventListener('transitionend', onTransitionEnd);
		main.cache.elems.headerShadow.removeChild(main.cache.elems.headerShadow.querySelector('.gradient:first-child'));
		main.cache.elems.headerShadow.classList.remove('transition');
	});

	var contrast = utils.getContrastYIQ(lighterColor.split(','));
	main.cache.elems.body.setAttribute('data-color-contrast', contrast);
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
