'use strict';

// Requires
var main = require('../main.js');
var pubsub = require('../pubsub.js');
var collection = require('../data/collection.js');
var config = require('../config.js');
var utils = require('../utils.js');
var placeholders = require('../placeholders.js');
var covers = require('../components/random-covers.js');

// Extend config
config.api.version = 'v1';

// Cached elems
var elems = {
	headerShadow: document.getElementsByClassName('header-shadow')[0],
};

function updateParallax (lastScrollY) {
	var translateY3d = function (elem, value) {
		var translate = 'translate3d(0px,' + value + 'px, 0px)';
		elem.style['-webkit-transform'] = translate;
		elem.style.transform = translate;
	};

	var speedDivider = 4.8;
	var translateValue = lastScrollY / speedDivider;

	if (translateValue < 0) {
		translateValue = 0;
	}

	translateY3d(main.cache.elems.collectionTitle, translateValue);
}

function updateHero (lastScrollY) {
	// Bail if we've reached the collection
	if (lastScrollY > main.cache.collectionTop) {
		return;
	}

	updateParallax(lastScrollY);
}

function updateDocumentColors (rgb, contrast) {
	// Change background color
	var lighterColor = utils.shadeRGBColor(rgb.toString(), contrast === 'dark' ? 0.37 : 0.1);
	main.cache.elems.body.style.backgroundColor = 'rgb(' + lighterColor + ')';

	var gradient = document.createElement('DIV');
	gradient.className = 'gradient';
	gradient.style.backgroundImage = 'linear-gradient(to bottom, rgba(' + lighterColor + ', 0.97) 0%, rgba(' + lighterColor + ', 0.85) 65%, rgba(' + lighterColor + ', 0.02) 100%)';
	elems.headerShadow.appendChild(gradient);
	setTimeout(function ( ) {
		elems.headerShadow.classList.add('transition');
	});

	elems.headerShadow.addEventListener('transitionend', function onTransitionEnd ( ) {
		elems.headerShadow.removeEventListener('transitionend', onTransitionEnd);
		elems.headerShadow.removeChild(elems.headerShadow.querySelector('.gradient:first-child'));
		elems.headerShadow.classList.remove('transition');
	});

	var bgContrast = utils.getContrastYIQ(lighterColor.split(','));
	main.cache.elems.body.setAttribute('data-color-contrast', bgContrast);
}

function resetDocumentColors ( ) {
	document.body.removeAttribute('style');
	document.body.removeAttribute('data-color-contrast');
	elems.headerShadow.querySelector('.gradient').removeAttribute('style');
}

function loading (id) {
	// Add assigned color based on first associated cover
	var cover = collection.getItem(id).covers[0];
	var elemLink = main.cache.elems.collection.querySelector('[data-id="' + id + '"] a');
	var rgb = cover.colors.primary;
	elemLink.style.background = 'rgba(' + rgb + ', 0.85)';

	updateDocumentColors(rgb, cover.colors.contrast);
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
placeholders.lazyLoad();

// Event messages
pubsub.subscribe('scrolling', updateHero);
pubsub.subscribe('itemMouseover', showItemCover);
pubsub.subscribe('audioLoading', loading);
pubsub.subscribe('audioPaused', paused);
pubsub.subscribe('audioStopped', stopped);
pubsub.subscribe('audioResumed', resume);
pubsub.subscribe('historyChanged', function (event) {
	if (!event) { resetDocumentColors(); }
});

// Events
var elemGoToTop = document.querySelector('.go-to-top');
if (elemGoToTop) {
	elemGoToTop.addEventListener('click', function (e) {
		utils.scrollToPosition(0, 400);
		e.preventDefault();
	});
}
