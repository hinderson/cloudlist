'use strict';

// Requires
var main = require('../main.js');
var pubsub = require('../pubsub.js');
var collection = require('../data/collection.js');
var config = require('../config.js');
var utils = require('../utils.js');
var volume = require('../components/volume.js')(document.getElementsByClassName('volume-slider')[0]);
var covers = require('../components/big-covers.js');

// Extend config
config.api.version = 'v1';

function updateDocumentColors (colors) {
	var lighterColor = utils.shadeRGBColor(colors.primary.toString(), colors.contrast === 'dark' ? 0.37 : 0.1);
	document.body.style.backgroundColor = 'rgba(' + lighterColor + ', 0.3)';

	var bgContrast = utils.getContrastYIQ(lighterColor.split(','));
	document.body.setAttribute('data-color-contrast', bgContrast);
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

// Event messages
pubsub.subscribe('itemMouseover', function (target) {
    var id = target.parentNode.getAttribute('data-id');
    var cover = collection.getItem(id).covers[0];
    utils.requestAnimFrame.call(window, function ( ) {
        updateDocumentColors(cover.colors);
    });
});
pubsub.subscribe('itemMouseover', showItemCover);

// Init main scripts
main.init();
