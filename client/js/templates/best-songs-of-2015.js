'use strict';

// Requires
var main = require('../main.js');
var pubsub = require('../pubsub.js');
var collection = require('../data/collection.js');
var config = require('../config.js');
var utils = require('../utils.js');
var placeholders = require('../components/placeholders.js');
var itemCover = require('../components/covers.js');

// Extend config
config.api.version = 'v1';

function cacheElems ( ) {
	main.cache.elems.collectionH1 = main.cache.elems.collectionTitle.querySelector('h1');
}

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

function updateDocumentColors (rgb, contrast) {
	// Change background color
	var lighterColor = utils.shadeRGBColor(rgb.toString(), contrast === 'dark' ? 0.37 : 0.1);
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

	var bgContrast = utils.getContrastYIQ(lighterColor.split(','));
	main.cache.elems.body.setAttribute('data-color-contrast', bgContrast);

	// Update hero header
	//main.cache.elems.collectionH1.style.fill = 'rgb(' + rgb + ')';
}

function resetDocumentColors ( ) {
	main.cache.elems.body.removeAttribute('style');
	main.cache.elems.body.removeAttribute('data-color-contrast');
	main.cache.elems.headerShadow.querySelector('.gradient').removeAttribute('style');
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
cacheElems();
placeholders.lazyLoad();

pubsub.subscribe('scrolling', updateHero);
pubsub.subscribe('audioLoading', loading);
pubsub.subscribe('audioPaused', paused);
pubsub.subscribe('audioStopped', stopped);
pubsub.subscribe('audioResumed', resume);
pubsub.subscribe('itemMouseover', itemCover.show);
pubsub.subscribe('resize', resizeEvent);
pubsub.subscribe('historyChanged', function (event) {
	if (!event) { resetDocumentColors(); }
});
