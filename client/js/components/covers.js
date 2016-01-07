'use strict';

// Requires
var utils = require('../utils.js');
var config = require('../config.js');
var cache = require('../cache.js');
var collection = require('../data/collection.js');

var loadCover = function (item, target) {
    var cover = item.covers[0];
    var format = cover.format === 'MP4' || cover.format === 'GIF' ? 'video' : 'img';
    var cdn = config.settings.cdn + '/' + format + '/';
    var coverContainer = target.parentNode.querySelector('.cover');
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

    target.coverLoaded = true;
};

var randomizePosition = function (item, target) {
    var cover = item.covers[0];
    var topPos = Math.floor(Math.random() * (-(cover.height - 100) - (-30)) + (- 30));
    var margin = (4 / 100) * cache.get('viewportWidth'); // The number 4 here is the percentage
    var leftMin = margin;
    var leftMax = (cache.get('viewportWidth') - cover.width) - margin;
    var leftPos = Math.floor(Math.random() * (leftMax - leftMin)) + leftMin;

    var coverContainer = target.parentNode.querySelector('[data-id="' + item.id + '"] .cover');
    coverContainer.style.cssText = coverContainer.style.cssText + 'top: ' + topPos +'px; left: ' + leftPos +'px';
};

var showCover = function (target) {
    var parentNode = target.parentNode;
    if (!collection.getAllItems() ||
        cache.get('viewportWidth') < 685 ||
        parentNode.classList.contains('playing') ||
    	parentNode.classList.contains('paused') ||
    	parentNode.classList.contains('loading')) {
            return;
        }

    var id = target.parentNode.getAttribute('data-id');
    var item = collection.getItem(id);

    randomizePosition(item, target);
    target.coverLoaded || loadCover(item, target);
};

module.exports.show = showCover;
