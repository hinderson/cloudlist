'use strict';

var main = require('../main.js');
var config = require('../config.js');
var utils = require('../utils.js');
var pubsub = require('../pubsub.js');
var collection = require('../data/collection.js');

var loadItemCover = function (elem, item) {
    var cover = item.covers[0];
    var format = cover.format === 'MP4' || cover.format === 'GIF' ? 'video' : 'img';
    var cdn = config.settings.cdn + '/' + format + '/';
    var coverContainer = elem.parentNode.querySelector('.cover');
    var coverElem = format === 'video' ? document.createElement(format) : new Image();

    function appendCover ( ) {
        coverElem.removeEventListener('canplay', appendCover);
        utils.requestAnimFrame.call(window, function ( ) {
            coverContainer.appendChild(coverElem);
            setTimeout(function ( ) {
                coverContainer.classList.add('cover-loaded');
            }, 10);
        });
    }

    coverElem.setAttribute('width', cover.width);
    coverElem.setAttribute('height', cover.height);
    coverElem.setAttribute('src', cdn + (cover.format === 'GIF' ? cover.video.filename : cover.filename));

    if (format === 'video' || cover.format === 'GIF') {
        coverElem.load();
        coverElem.play();
        coverElem.setAttribute('muted', '');
        coverElem.setAttribute('loop', true);
        coverElem.addEventListener('canplay', appendCover);
    } else {
        coverElem.setAttribute('alt', '');
        coverElem.onload = appendCover;
    }

    elem.coverLoaded = true;
};

var randomCoverPosition = function (elem, item) {
    var cover = item.covers[0];
    var topPos = Math.floor(Math.random() * (-(cover.height - 100) - (-30)) + (- 30));
    var margin = (4 / 100) * main.viewportWidth; // The number 4 here is the percentage
    var leftMin = margin;
    var leftMax = (main.viewportWidth - cover.width) - margin;
    var leftPos = Math.floor(Math.random() * (leftMax - leftMin)) + leftMin;

    var coverContainer = elem.parentNode.querySelector('[data-id="' + item.id + '"] .cover');
    coverContainer.style.cssText = coverContainer.style.cssText + 'top: ' + topPos +'px; left: ' + leftPos +'px';
};

var showCover = function (elem) {
    var id = elem.parentNode.getAttribute('data-id');
    var item = collection.getItem(id);
    randomCoverPosition(elem, item);
    elem.coverLoaded || loadItemCover(elem, item);
};

// Reposition cover on currently playing item
pubsub.subscribe('resize', function (prev) {
	if (main.cache.elems.currentItem !== null) {
		var widthDiff = Math.abs(prev.prevWidth - main.viewportWidth);
		var heightDiff = Math.abs(prev.prevHeight - main.viewportHeight);

		// Only reflow/reposition element if the diff between
		// previous size and new is more than 40px
		if (widthDiff >= 40 || heightDiff >= 40) {
			showCover(main.cache.elems.currentItem.firstChild);
		}
	}
});

module.exports = {
    show: showCover
};
