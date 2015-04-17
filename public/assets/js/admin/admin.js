/*jslint browser: true */
/*global Zepto */

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
			var songId = $(this).closest('tr').attr('data-id');
			var collectionId = $(this).closest('table').attr('data-id');
			$.ajax({
				type: 'DELETE',
				url: '/deletesong/',
				data: {
					'songId': songId,
					'collectionId': collectionId
				},
				success: function (response) {
					// Check for a successful (blank) response
					if (response.msg !== '') {
						alert('Error: ' + response.msg);
					}

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
				$('form .img').attr('style', 'background-image:url(' + e.target.result + ');');
				clearImageSearchResults();
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
		container.className = "search-results";

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
		if (elem.style.display == 'block' || elem.style.display=='') {
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
	advancedInputs.style.display = 'none';

	var showHideBtn = document.createElement('a');
	showHideBtn.innerHTML = '+ More';
	showHideBtn.className = 'expand-advanced';
	showHideBtn.href = '/';
	advancedInputs.parentNode.insertBefore(showHideBtn, advancedInputs.nextSibling);
	showHideBtn.addEventListener('click', toggleAdvancedInputs, false);


	var deleteButtons = document.querySelectorAll('.song-list button.delete');
	[].forEach.call(deleteButtons, function (e) {
		// TEMP
		return;

		//e.addEventListener('click', deleteSong, false);
	});

	var authenticateSpotifyUserBtn = document.querySelector('#spotify');
	authenticateSpotifyUserBtn.addEventListener('click', createSpotifyPlaylist, false);

	document.querySelector('input[name="artist"]').onchange = function (e) {
		fetchArtistImages(this.value);
	};

	document.querySelector('input[name="audio"]').onchange = function (e) {
		id3(this.files[0], function (err, tags) {
			showMetaDataInputs();
			populateInputs(tags);
		});
	};

	document.querySelector('input[name="soundcloud"]').onblur = function (e) {
		fetchSoundCloudMetaData(this.value);
	};

	document.querySelector('input[name="image"]').onchange = function (e) {
		readImgURL(this);
	};



	// LIVE EDIT
	var editableSongs = document.querySelectorAll('table.collection [contenteditable]');
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

	var editableCollectionTitle = document.querySelector('table.collection .collection-title span');
	var postCollectionEdit = function (e) {
		var title = e.target.innerHTML;
		var id =  document.querySelector('table.collection').getAttribute('data-id');

		// Post to database
		$.ajax({
			type: 'POST', // TEMP: Update to real REST API with PUT
			url: '/update-collection/' + id,
			data: {
				'title': title
			}
		});
	};
	editableCollectionTitle.addEventListener('blur', postCollectionEdit, false);

	var availability = document.querySelectorAll('.availability input');
	[].forEach.call(availability, function (e) {
		e.addEventListener('click', postSongEdit, false);
	});



	// DRAG AND DROP
	var collection = document.querySelector('.collection > tbody');

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
	var items = document.querySelector('.collection > tbody').children;
	var sortOrder = [].map.call(items, function (obj) {
		return obj.getAttribute('data-id');
	});

	collection.addEventListener('slip:reorder', function (e) {
		e.target.parentNode.insertBefore(e.target, e.detail.insertBefore);

		updateIndexInDatabase(collectionId);

		return false;

	}, false);

	var slip = new Slip(collection);

})();