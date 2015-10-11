'use strict';

var order;
var items;

// Store GET request, structure and store it in global array
var setCollection = function (id, callback) {
	if (!id) return;

	var XMLHttp = new XMLHttpRequest();

	XMLHttp.open('GET', '/song-collection/' + id, true);
	XMLHttp.onreadystatechange = function ( ) {
		if (XMLHttp.readyState === 4) {
			if (XMLHttp.status === 200) {
				var response = JSON.parse(XMLHttp.responseText);
				items = response.items;
				order = response.order;
				return callback(response);
			}
		}
	};
	XMLHttp.send(null);
};

var getCollection = function ( ) {
	return items;
};

var getCollectionIds = function ( ) {
	return Object.keys(getCollection());
};

var getCollectionOrder = function ( ) {
	return order.slice(0);
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

var getNextItem = function (currentId) {
	var itemId = getCollectionOrder()
		.splice(getItemPosition(currentId) + 1)
		.filter(function (id) {
			return getItem(id).available;
		})[0] || getFirstItem().id;
	return getItem(itemId);
};

var getPreviousItem = function (currentId) {
	var itemId = getCollectionOrder()
		.slice(0, getItemPosition(currentId))
		.reverse()
		.filter(function (id) {
			return getItem(id).available;
		})[0] || getLastItem().id;
	return getItem(itemId);
};

var getFirstItem = function ( ) {
	var id = getCollectionOrder()[0];
	return getItem(id);
};

var getLastItem = function ( ) {
	var collectionLength = getCollectionOrder().length;
	var id = getCollectionOrder()[collectionLength - 1];
	return getItem(id);
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
