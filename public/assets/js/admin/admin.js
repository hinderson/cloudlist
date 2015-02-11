/*jslint browser: true */
/*global Zepto */

(function () {
	'use strict';

	function updateIndexInDatabase ( ) {

		var items = document.querySelector('.collection > tbody').children;
		var newSortOrder = [].map.call(items, function (obj) {
			return obj.getAttribute('data-id');
		});

		// Post to database
		$.ajax({
			type: 'PUT',
			url: '/orderitems/',
			data: {
				'changes': newSortOrder
			},
			success: function (response) {
				// Check for a successful (blank) response
				if (response.msg !== '') {
					alert('Error: ' + response.msg);
				}

				// Update global sort array
				sortOrder = newSortOrder;
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
			$.ajax({
				type: 'DELETE',
				url: '/deletesong/' + songId,
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

	var deleteButtons = document.querySelectorAll('.song-list button.delete');
	[].forEach.call(deleteButtons, function (e) {
		e.addEventListener('click', deleteSong, false);
	});

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
	var contentEditables = document.querySelectorAll('[contenteditable]');
	var postEdit = function (e) {
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
			type: 'PUT',
			url: '/updateitem/',
			data: {
				'id': id,
				'field': type,
				'content': content
			},
			success: function (response) {
				// Check for a successful (blank) response
				if (response.msg !== '') {
					alert('Error: ' + response.msg);
				}
			}
		});
	};
	[].forEach.call(contentEditables, function (e) {
		e.addEventListener('blur', postEdit, false);
	});

	var availability = document.querySelectorAll('.availability input');
	[].forEach.call(availability, function (e) {
		e.addEventListener('click', postEdit, false);
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

	// Store item order on load
	var items = document.querySelector('.collection > tbody').children;
	var sortOrder = [].map.call(items, function (obj) {
		return obj.getAttribute('data-id');
	});

	collection.addEventListener('slip:reorder', function (e) {
		e.target.parentNode.insertBefore(e.target, e.detail.insertBefore);

		updateIndexInDatabase( );

		return false;

	}, false);

	var slip = new Slip(collection);

})();