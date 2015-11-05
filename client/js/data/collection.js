'use strict';

// Requires
var utils = require('../utils.js');
var config = require('../config.js');

var order;
var items;

// Store GET request, structure and store it in global array
var getCollection = new Promise(function (resolve, reject) {
	var url = config.api.url + config.api.version + '/collection';
    utils.getJSON(url).then(function (data) {
		if (data) {
			items = data.items;
			order = data.order;
	        resolve(data);
		} else {
			reject('No data');
		}
    }).catch(function (error) {
		// TODO: Handle error
        console.log('An error has occured', error.stack);
    });
});

var getCollectionOrder = function ( ) {
	return order.slice(0);
};

var setCollectionOrder = function (newOrder) {
	order = newOrder;
};

// Sorts and then returns the new order
var sortCollection = function (items, key, reverse) {
	var order = getAllItemIds().map(function (id) {
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

var getAllItemIds = function ( ) {
	return Object.keys(getAllItems());
};

var getAllItems = function ( ) {
	return items;
};

var getItem = function (id) {
	return getAllItems()[id];
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
	getCollection: getCollection,
	getCollectionOrder: getCollectionOrder,
	sortCollection: sortCollection,
	getAllItems: getAllItems,
	getItem: getItem,
	getItemPosition: getItemPosition,
	getNextItem: getNextItem,
	getPreviousItem: getPreviousItem,
	getFirstItem: getFirstItem,
	getLastItem: getLastItem
};
