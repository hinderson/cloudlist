webpackJsonp([1],[
/* 0 */
/*!****************************************!*\
  !*** ./assets/js/templates/default.js ***!
  \****************************************/
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	// Requires
	var main = __webpack_require__(/*! ../main.js */ 1);
	var pubsub = __webpack_require__(/*! ../pubsub.js */ 2);
	var audio = __webpack_require__(/*! ../audio.js */ 3);
	
	var cacheElems = function ( ) {
		// Extends to main cache object
		main.cache.elems.playBtn = document.querySelector('.hero button');
	};
	
	var registerEvents = function ( ) {
		main.cache.elems.playBtn.addEventListener('click', function (e) {
			// Play first song in collection
			var id = main.cache.collection.order[0];
			audio.play(id);
		}.bind(this), false);
	};
	
	var updateParallax = function (lastScrollY) {
		// Bail if we've reached the collection
		if (lastScrollY > main.cache.collectionTop) {
			return;
		}
	
		var translateY3d = function (elem, value) {
			var translate = 'translate3d(0px,' + value + 'px, 0px)';
			elem.style['-webkit-transform'] = translate;
			elem.style.transform = translate;
		};
	
		var speedDivider = 10;
		var translateValue = lastScrollY / speedDivider;
	
		if (translateValue < 0) {
			translateValue = 0;
		}
	
		translateY3d(main.cache.elems.heroContent, translateValue);
	};
	
	cacheElems();
	registerEvents();
	main.init();
	
	pubsub.subscribe('scrolling', updateParallax);
	
	// TEMP: Test opacity change on header
	/*
	pubsub.subscribe('scrolling', function (lastScrollY) {
		var distance = Cloudlist.getViewportDimensions().height * 1.7;
		c.elems.heroImage.style.webkitAnimationFillMode = 'backwards';
		c.elems.heroImage.style.opacity = Math.max((1 - lastScrollY/distance), 0);
	});
	*/

/***/ }
]);
//# sourceMappingURL=default.js.map