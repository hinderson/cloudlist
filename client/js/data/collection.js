'use strict';

var order;
var songs;

// Store GET request, structure and store it in global array
var setCollection = function (id, callback) {
	if (!id) return;

	var XMLHttp = new XMLHttpRequest();

	XMLHttp.open('GET', '/song-collection/' + id, true);
	XMLHttp.onreadystatechange = function ( ) {
		if (XMLHttp.readyState === 4) {
			if (XMLHttp.status === 200) {
				var response = JSON.parse(XMLHttp.responseText);
				songs = response.items;
				order = response.order;
				return callback(response);
			}
		}
	};
	XMLHttp.send(null);
};

var getCollection = function ( ) {
	return songs;
};

var getCollectionIds = function ( ) {
	return Object.keys(getCollection());
};

var getCollectionOrder = function ( ) {
	return order;
};

var setCollectionOrder = function (newOrder) {
	order = newOrder;
};

// Sorts and then returns the new order
var sortCollection = function (items, key, reverse) {
	var order = getCollectionIds().map(function (id) {
		return {
			'id': id,
			'index': items[id].index,
			'title': items[id].title,
			'artist': items[id].artist,
			'time': Math.round(items[id].audio.duration)
		};
	}).sort(function (a, b) {
		if (a[key] > b[key]) return 1;
		if (a[key] < b[key]) return -1;
		return 0;
	}).map(function (item) {
		return item.id;
	});

	if (reverse) order.reverse();

	setCollectionOrder(order);
	return order;
};

var getItem = function (id) {
	return getCollection()[id];
};

var getItemPosition = function (id) {
	return getCollectionOrder().indexOf(id);
};

var getNextItem = function (currentIndex) {
	return getCollectionOrder()[currentIndex + 1] || getFirstItem();
};

var getPreviousItem = function (currentIndex) {
	return getCollectionOrder()[currentIndex - 1] || getLastItem();
};

var getFirstItem = function ( ) {
	return getCollectionOrder()[0];
};

var getLastItem = function ( ) {
	var collectionLength = getCollectionOrder().length;
	return getCollectionOrder()[collectionLength - 1];
};

// Export interface
module.exports = {
	setCollection: setCollection,
	getCollection: getCollection,
	getCollectionOrder: getCollectionOrder,
	sortCollection: sortCollection,
	getItem: getItem,
	getItemPosition: getItemPosition,
	getNextItem: getNextItem,
	getPreviousItem: getPreviousItem,
	getFirstItem: getFirstItem,
	getLastItem: getLastItem
};
