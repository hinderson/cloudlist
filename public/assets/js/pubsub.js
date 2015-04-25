/*jslint browser: true */

;(function () {
	'use strict';

	var pubsub = (function () {

		var topic = {};

		var subscribe = function (name, listener) {
			if (!topic[name]) {
				topic[name] = { queue: [] };
			}
			var index = topic[name].queue.push(listener) - 1;

			return {
				remove: function() {
					delete topic[name].queue[index];
				}
			};
		};

		var publish = function (name, data) {
			if (!topic[name] || topic[name].queue.length == 0) {
				return;
			}

			topic[name].queue.forEach(function (callback) {
				callback(data || null);
			});
		};

		return {
			subscribe: subscribe,
			publish: publish
		};
	}());

	// Expose access to the constructor
	window.pubsub = pubsub;

}());