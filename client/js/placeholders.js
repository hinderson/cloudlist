'use strict';

// Requires
var utils = require('./utils.js');
var config = require('./config.js');
var collection = require('./data/collection.js');

// Vendor requires
var stackBlur = require('./vendor/stackblur.js');

var ticking = false;
var unloadedItems = [];

var onScroll = function ( ) {
	var requestTick = function ( ) {
		loadVisiblePlaceholders();
		ticking = false;
	};

	if (!ticking) {
		requestAnimationFrame(requestTick);
		ticking = true;
	}
};

var onResize = function ( ) {
	loadVisiblePlaceholders();
};

var addEventListeners = function ( ) {
	window.addEventListener('scroll', onScroll, false);
    window.addEventListener('resize', onResize, false);
};

var removeEventListeners = function ( ) {
    window.removeEventListener('scroll', onScroll, false);
    window.removeEventListener('resize', onResize, false);
};

// Document scroll value helper function
var getDocumentScrollTop = function ( ) {
	if (window.pageYOffset === undefined) {
		return (document.documentElement || document.body.parentNode || document.body).scrollTop;
	}
	return window.pageYOffset;
};

// Determine if an element is visible (even partially) in the viewport
var isPartiallyInViewport = function (element, offset) {
	var winTop = getDocumentScrollTop();
	var winHeight = document.documentElement.clientHeight;
	var winBottom = winTop + winHeight;
	offset = offset || 0;

	var rect = element.getBoundingClientRect();
	var elTop = rect.top + winTop - offset;
	var elBottom = rect.bottom + winTop + offset;

	return elBottom > winTop && elTop < winBottom;
};

var loadVisiblePlaceholders = function ( ) {
	utils.forEach(unloadedItems, function (index, element) {
		if (!element) { return; }

		if (isPartiallyInViewport(element)) {
            createPlaceholder(element);

			delete unloadedItems[index];
            if (index === unloadedItems.length - 1) {
                // All images loaded
                removeEventListeners();
            }
		}
	});
};

var createPlaceholder = function (element) {
    var id = element.getAttribute('data-id');
    var coverElem = element.querySelector('.cover');
    var cover = collection.getItem(id).covers[0];
    var placeholder = cover.placeholder;

    // Create placeholder
    var image = new Image();
	image.crossOrigin = '';
    image.src = 'https://static.cloudlist.io' + '/img/' + placeholder.filename;
    image.alt = '';
    image.width = placeholder.width;
    image.height = placeholder.height;
    image.className = 'placeholder';

    // Create blurry placeholder
    var canvas = document.createElement('canvas');
    canvas.width = cover.width;
    canvas.height = cover.height;
    canvas.className = 'canvas';

    image.onload = function ( ) {
        utils.requestAnimFrame.call(window, function ( ) {
            coverElem.appendChild(canvas);
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            stackBlur.canvasRGB(canvas, 0, 0, canvas.width, canvas.height, 40);
        });
    };
};

var lazyLoad = function ( ) {
    var nodeList = document.querySelectorAll('.collection ol li');
    unloadedItems = Array.prototype.slice.call(nodeList);

	// Wait for collection to load
	collection.getCollection.then(function ( ) {
		loadVisiblePlaceholders();
		addEventListeners();
	});
};

module.exports = {
    lazyLoad: lazyLoad
};
