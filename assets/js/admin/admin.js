// Requires
var $ = require('webpack-zepto');
var id3 = require('./libs/id3.js');
var Slip = require('./libs/slip.js');

var gradify = function (image) {
	// Colors which do not catch the eye
	var ignoredColors = [[0,0,0,], [255,255,255]];

	// Sensitivity to ignored colors
	var BWSensitivity = 4;

	// Overall sensitivity to closeness of colors.
    var sensitivity = 12;

	function getCanvas (img) {
		var canvas = document.createElement('canvas');
		var ctx = canvas.getContext('2d');
		canvas.height = img.height;
		canvas.width = img.width;
		ctx.drawImage(img, 0, 0, 60, 60);
		return canvas;
	}

	function toImageData (img) {
		var canvas = getCanvas(img);
		var ctx = canvas.getContext('2d');
		return ctx.getImageData(0, 0, 60, 60);
	}

	function getColorDiff (first, second) {
		// *Very* rough approximation of a better color space than RGB.
		return Math.sqrt(Math.abs(1.4 * Math.sqrt(Math.abs(first[0] - second[0])) +
			0.8 * Math.sqrt(Math.abs(first[1] - second[1])) + 0.8 * Math.sqrt(Math.abs(first[2] - second[2]))));
	}

	function createCSS (colors) {
		var directionMap = {
			0: 'right top',
			90: 'left top',
			180: 'left bottom',
			270: 'right bottom',
			360: 'right top'
		};

		var gradient = '';
		for (var i = 0; i < colors.length; i++) {
			var oppDir = directionMap[(colors[i][3] + 90) % 360];
			gradient += 'linear-gradient(to ' + oppDir + ', rgba(' +
				colors[i][0] + ',' + colors[i][1] + ',' + colors[i][2] + ',0) 0%, rgba(' +
				colors[i][0] + ',' + colors[i][1] + ',' + colors[i][2] + ',1) 100%),';
		}
		gradient = gradient.slice(0, -1);

		return gradient;
	}

	function getQuads (colors) {
		// Second iterration of pix data is nescessary because
		// now we have the base dominant colors, we have to check the
		// Surrounding color space for the average location.
		// This can/will be optimized a lot

		// Resultant array;
		var quadCombo = [0,0,0,0];
		var takenPos = [0,0,0,0];

		// Keep track of most dominated quads for each col.
		var quad = [
			[[0,0],[0,0]],
			[[0,0],[0,0]],
			[[0,0],[0,0]],
			[[0,0],[0,0]],
		];

		for (var j = 0; j < this.data.data.length; j+= 4) {
			// Iterate over each pixel, checking it's closeness to our colors.
			var r = this.data.data[j];
			var g = this.data.data[j+1];
			var b = this.data.data[j+2];
			for (var i = 0; i < colors.length; i++) {
			  var color = colors[i];
			  var diff = getColorDiff(color, [r,g,b]);
			  if (diff < 4.3) {
				// If close enough, increment color's quad score.
				var xq = (Math.floor(((j/4)%60.0)/30));
				var yq = (Math.round((j/4)/(60.0*60)));
				quad[i][yq][xq] += 1;
			  }
			}
		}

		for (var i = 0; i < colors.length; i++) {
			// For each col, try and find the best avail quad.
			var quadArr = [];
			quadArr[0] = quad[i][0][0];
			quadArr[1] = quad[i][1][0];
			quadArr[2] = quad[i][1][1];
			quadArr[3] = quad[i][0][1];
			var found = false;

			for (var j = 0; !found; j++) {
				var bestChoice = quadArr.indexOf(Math.max.apply(Math, quadArr));
				if (Math.max.apply(Math, quadArr)===0) {
					colors[i][3] = 90 * quadCombo.indexOf(0);
					quadCombo[quadCombo.indexOf(0)] = colors[i];
					found = true;
				}
				if (takenPos[bestChoice] === 0) {
					colors[i][3] = 90 * bestChoice;
					quadCombo[i] = colors[i];
					takenPos[bestChoice] = 1;
					found = true;
					break;
				} else {
					quadArr[bestChoice] = 0;
				}
			}
		}

		// Create the rule.
		return createCSS(quadCombo);
	}

	function getColors (colors) {
		// Select for dominant but different colors.
		var selectedColors = [],
			found = false,
			diff;

		var bws = BWSensitivity;

		while (selectedColors.length < 4 && !found) {
			selectedColors = [];
			for (var j=0; j < colors.length; j++) {
				var acceptableColor = false;
				// Check curr color isn't too black/white.
				for (var k = 0; k < ignoredColors.length; k++) {
					diff = getColorDiff(ignoredColors[k], colors[j][0]);
					if (diff < bws) {
					  acceptableColor = true;
					  break;
					}
				}

				// Check curr color is not close to previous colors
				for (var g = 0; g < selectedColors.length; g++) {
					diff = getColorDiff(selectedColors[g], colors[j][0]);
					if (diff < sensitivity) {
					  acceptableColor = true;
					  break;
					}
				}

				if (acceptableColor) { continue; }
				// IF a good color, add to our selected colors!
				selectedColors.push(colors[j][0]);
				if (selectedColors.length > 3) {
					found = true;
					break;
				}
			}

			// Decrement both sensitivities.
			if (bws > 2) {
				bws -= 1;
			} else {
				sensitivity--;
				// Reset BW sensitivity for new iteration of lower overall sensitivity.
				bws = this.BWSensitivity;
			}
		}
		return getQuads(selectedColors);
	}

	function handleData (data) {
		// Count all colors and sort high to low.
		var r = 0,
			b = 0,
			g = 0;

		this.data = data;
		var colorMap = {};

		for (i = 0; i < data.data.length; i += 4) {
			r = data.data[i];
			g = data.data[i+1];
			b = data.data[i+2];
			// Pad the rgb values with 0's to make parsing easier later.
			var newCol = ('00' + r.toString()).slice(-3) + ('00' + g.toString()).slice(-3) + ('00' + b.toString()).slice(-3);
			if (newCol in colorMap) {
				colorMap[newCol].val += 1;
			} else {
				colorMap[newCol] = { 'val': 0 };
			}
		}
		var items = Object.keys(colorMap).map(function(key) {
			return [[parseInt(key.slice(0, 3)), parseInt(key.slice(3, 6)), parseInt(key.slice(6, 9))], colorMap[key].val];
		});
		items.sort(function(first, second) {
			return second[1] - first[1];
		});
		this.colMap = colorMap;
		return getColors(items);
	}

	return handleData(toImageData(image));
};

(function () {
	'use strict';

	function updateIndexInDatabase (id) {

		var items = collection.children;
		var newSortOrder = [].map.call(items, function (obj) {
			return obj.getAttribute('data-id');
		});

		// Post to database
		$.ajax({
			type: 'POST', // TEMP: Update to real REST API with PUT
			url: '/update-collection/' + id,
			data: {
				'items': newSortOrder
			},
			success: function (res) {
				// Update global sort array
				sortOrder = newSortOrder;
			}
		});
	}

	function createSpotifyPlaylist (event) {
		event.preventDefault();

		$.ajax({
			type: 'GET',
			url: '/spotify/create-playlist/' + collectionId,
			success: function (url) {
				window.open(url, '_blank');
			}
		});
	}

	function deleteSong (event) {
		event.preventDefault();

		// Pop up a confirmation dialog
		var confirmation = confirm('Are you sure you want to delete this song?');

		// Check and make sure the user confirmed
		if (confirmation) {

			// If they did, do our delete
			var songId = $(this).closest('.collection-item').attr('data-id');
			$.ajax({
				type: 'POST',
				url: '/delete-song/' + songId,
				success: function ( ) {
					window.location.reload(true);
				}
			});
		} else {
			return false;
		}
	}

	function readImgURL (input) {
		if (input.files && input.files[0]) {
			var reader = new FileReader();

			reader.onload = function (e) {
				/*
				var images = document.querySelectorAll('fieldset.image .search-results input');
				if (images.length) {
					images = images.reverse();
					for (var i = 0, len = images.length; i < len; i++) {
						images[i].setAttribute('checked', false);
					}
				}
				*/

				var tempImage = new Image();
				tempImage.src = e.target.result;
				tempImage.onload = function ( ) {

					// Adds gradient placeholder value to hidden input in form
					var gradient = gradify(tempImage);
					$('form input[name="gradientplaceholder"]').attr('value', gradient);

					// Updates preview area
					var $preview = $('form .preview');
					if ($preview.length) {
						$preview.find('.img').css('background-image', 'url(' + e.target.result + ')');
						$preview.find('.placeholder').css('background-image', gradient);
					} else {
						$('form .image .group').prepend('<div class="preview"><div class="img" style="background-image: url(' + e.target.result +');"></div><div class="placeholder" style="background-image: ' + gradient +';"></div></div>');
					}
				};
			};

			reader.readAsDataURL(input.files[0]);
		}
	}

	function showMetaDataInputs ( ) {
		$('fieldset.metadata').show();
	}

	function populateInputs (data) {
		if (data.artist || data.user && data.user.username) {
			document.querySelector('input[name="artist"]').value = data.artist || data.user && data.user.username;
			fetchArtistImages(data.artist || data.user && data.user.username);
		}

		if (data.title) {
			document.querySelector('input[name="title"]').value = data.title;
		}

		if (data.album) {
			document.querySelector('input[name="album"]').value = data.album;
		}

		if (data.v2 && data.v2.length) {
			document.querySelector('input[name="starttime"]').value = 0;
			document.querySelector('input[name="endtime"]').value = data.v2.length;
		}

		if (data.tag_list) {
			document.querySelector('input[name="tags"]').value = data.tag_list;
		}
	}

	function fetchSoundCloudMetaData (url) {
		if (url) {
			var consumerKey = '879664becb66c01bf10c8cf0fd4fbec3';
			$.ajax({
				url: 'https://api.soundcloud.com/resolve?url=' + url + '&format=json&consumer_key=' + consumerKey,
				success: function (data) {
					console.log(data);
					showMetaDataInputs();
					populateInputs(data);
				},
			});
		}
	}

	function fetchArtistImages (artist) {
		$.ajax({
			url: '/fetch-artist-images/',
			data: {
				artist: artist
			},
			success: function (data) {
				populateImageSearchResults(data);
			}
		});
	}

	function populateImageSearchResults (images) {
		if (!images.length) { return; }

		clearImageSearchResults();

		var imageSection = document.querySelector('fieldset.image');

		var container = document.createElement('div');
		container.className = 'search-results';

		for (var i = 0, len = images.length; i < len; i++) {
			var imageUrl = images[i];

			var radio = document.createElement('input');
			radio.id = 'img-' + i;
			radio.name = 'image';
			radio.type = 'radio';
			radio.value = imageUrl;

			var label = document.createElement('label');
			label.setAttribute('for', 'img-' + i);

			var img = document.createElement('img');
			img.src = imageUrl;
			img.alt = '';

			label.appendChild(img);
			container.appendChild(radio);
			container.appendChild(label);
		}

		var or = document.createElement('p');
		or.innerHTML = '<em>or</em>';
		container.appendChild(or);

		imageSection.insertBefore(container, imageSection.childNodes[2]);
	}

	function clearImageSearchResults () {
		var container = document.querySelector('fieldset.image .search-results');
		if (container) {
			container.parentNode.removeChild(container);
		}
	}

	function toggleElemVisibility (elem) {
		if (elem.style.display === 'block' || elem.style.display === '') {
			elem.style.display = 'none';
		} else {
			elem.style.display = 'block';
		}
	}

	function toggleAdvancedInputs (event) {
		event.preventDefault();

		var target = event.target;

		if (target.classList.contains('expanded')) {
			target.classList.remove('expanded');
			target.innerHTML = '+ More';
		} else {
			target.classList.add('expanded');
			target.innerHTML = '- Less';
		}

		toggleElemVisibility(advancedInputs);
	}

	var advancedInputs = document.querySelector('form .advanced');
	if (advancedInputs) {
		advancedInputs.style.display = 'none';
	}

	var showHideBtn = document.createElement('a');
	showHideBtn.innerHTML = '+ More';
	showHideBtn.className = 'expand-advanced';
	showHideBtn.href = '/';
	if (advancedInputs) {
		advancedInputs.parentNode.insertBefore(showHideBtn, advancedInputs.nextSibling);
	}
	showHideBtn.addEventListener('click', toggleAdvancedInputs, false);


	var deleteButtons = document.querySelectorAll('.song-list button.delete');
	[].forEach.call(deleteButtons, function (e) {
		e.addEventListener('click', deleteSong, false);
	});

	var inputName = document.querySelector('input[name="artist"]');
	if (inputName) {
		inputName.onchange = function (e) {
			fetchArtistImages(this.value);
		};
	}

	var inputAudio = document.querySelector('input[name="audio"]');
	if (inputAudio) {
		inputAudio.onchange = function (e) {
			id3(this.files[0], function (err, tags) {
				showMetaDataInputs();
				populateInputs(tags);
			});
		};
	}

	var inputSoundcloud = document.querySelector('input[name="soundcloud"]');
	if (inputSoundcloud) {
		inputSoundcloud.onblur = function (e) {
			fetchSoundCloudMetaData(this.value);
		};
	}

	var inputImage = document.querySelector('input[name="image"]');
	if (inputImage) {
		inputImage.onchange = function (e) {
			readImgURL(this);
		};
	}

	// LIVE EDIT
	var editableSongs = document.querySelectorAll('.collection [contenteditable]');
	var postSongEdit = function (e) {
		var target = e.target;
		var id = target.parentNode.getAttribute('data-id');
		var type = target.className;
		var content = target.innerHTML;

		// Checkboxes
		if (id === null) {
			id = target.parentNode.parentNode.getAttribute('data-id');
			type = 'available';
			content = target.checked ? true : false;
		}

		// Post to database
		$.ajax({
			type: 'POST', // TEMP: Update to real REST API with PUT
			url: '/update-song/' + id,
			data: {
				'field': type,
				'content': content
			}
		});
	};
	[].forEach.call(editableSongs, function (e) {
		e.addEventListener('blur', postSongEdit, false);
	});

	var editableCollectionTitle = document.querySelector('.collection .collection-title span');
	var postCollectionEdit = function (e) {
		var title = e.target.innerHTML;
		var id =  document.querySelector('.collection').getAttribute('data-id');

		// Post to database
		$.ajax({
			type: 'POST', // TEMP: Update to real REST API with PUT
			url: '/update-collection/' + id,
			data: {
				'title': title
			}
		});
	};

	if (editableCollectionTitle) {
		editableCollectionTitle.addEventListener('blur', postCollectionEdit, false);
	}

	var availability = document.querySelectorAll('.availability input');
	[].forEach.call(availability, function (e) {
		e.addEventListener('click', postSongEdit, false);
	});



	// DRAG AND DROP
	var collection = document.querySelector('.collection-list');
	if (collection) {
		collection.addEventListener('slip:beforereorder', function (e) {
			if (/demo-no-reorder/.test(e.target.className)) {
				e.preventDefault();
			}
		}, false);

		collection.addEventListener('slip:beforewait', function (e) {
			if (e.target.className.indexOf('handle') > -1) {
				e.preventDefault();
			}
		}, false);

		collection.addEventListener('slip:afterswipe', function (e) {
			e.target.parentNode.appendChild(e.target);
		}, false);

		var collectionId = document.querySelector('.collection').getAttribute('data-id');

		// Store item order on load
		var items = document.querySelector('.collection-list').children;
		var sortOrder = [].map.call(items, function (obj) {
			return obj.getAttribute('data-id');
		});

		collection.addEventListener('slip:reorder', function (e) {
			e.target.parentNode.insertBefore(e.target, e.detail.insertBefore);

			updateIndexInDatabase(collectionId);

			return false;
		}, false);

		new Slip(collection);
	}
})();
