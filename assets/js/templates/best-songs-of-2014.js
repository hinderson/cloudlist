'use strict';

// Requires
var main = require('../main.js');
var pubsub = require('../pubsub.js');
var audio = require('../audio.js');

// TODO: Clean up this intro animation
setTimeout(function ( ) {
	main.cache.elems.collectionTitle.classList.add('animate');
}, 150);

main.init();