'use strict';

// Requires
var main = require('../main.js');

// TODO: Clean up this intro animation
setTimeout(function ( ) {
	main.cache.elems.collectionTitle.classList.add('animate');
}, 160);

main.init();