window['Slip'] = (function () {
	'use strict';

	var damnYouChrome = /Chrome\/[34]/.test(navigator.userAgent); // For bugs that can't be programmatically detected :( Intended to catch all versions of Chrome 30-40
	var needsBodyHandlerHack = damnYouChrome; // Otherwise I _sometimes_ don't get any touchstart events and only clicks instead.

	/* When dragging elements down in Chrome (tested 34-37) dragged element may appear below stationary elements.
	   Looks like WebKit bug #61824, but iOS Safari doesn't have that problem. */
	var compositorDoesNotOrderLayers = damnYouChrome;

	// -webkit-mess
	var testElement = document.createElement('div');

	var transitionPrefix = "webkitTransition" in testElement.style ? "webkitTransition" : "transition";
	var transformPrefix = "webkitTransform" in testElement.style ? "webkitTransform" : "transform";
	var transformProperty = transformPrefix === "webkitTransform" ? "-webkit-transform" : "transform";
	var userSelectPrefix = "webkitUserSelect" in testElement.style ? "webkitUserSelect" : "userSelect";

	testElement.style[transformPrefix] = 'translateZ(0)';
	var hwLayerMagic = testElement.style[transformPrefix] ? 'translateZ(0) ' : '';
	var hwTopLayerMagic = testElement.style[transformPrefix] ? 'translateZ(1px) ' : '';
	testElement = null;

	var globalInstances = 0;
	var attachedBodyHandlerHack = false;
	var nullHandler = function(){};

	function Slip (container, options) {
		if ('string' === typeof container) container = document.querySelector(container);
		if (!container || !container.addEventListener) throw new Error("Please specify DOM node to attach to");

		if (!this || this === window) return new Slip(container, options);

		this.options = options;

		// Functions used for as event handlers need usable `this` and must not change to be removable
		this.cancel = this.setState.bind(this, this.states.idle);
		this.onTouchStart = this.onTouchStart.bind(this);
		this.onTouchMove = this.onTouchMove.bind(this);
		this.onTouchEnd = this.onTouchEnd.bind(this);
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
		this.onMouseLeave = this.onMouseLeave.bind(this);
		this.onSelection = this.onSelection.bind(this);

		this.setState(this.states.idle);
		this.attach(container);
	}

	function getTransform (node) {
		var transform = node.style[transformPrefix];
		if (transform) {
			return {
				value:transform,
				original:transform,
			};
		}

		if (window.getComputedStyle) {
			var style = window.getComputedStyle(node).getPropertyValue(transformProperty);
			if (style && style !== 'none') return {value:style, original:''};
		}
		return {value:'', original:''};
	}

	// All functions in states are going to be executed in context of Slip object
	Slip.prototype = {

		container: null,
		options: {},
		state: null,

		target: null, // the tapped/swiped/reordered node with height and backed up styles

		usingTouch: false, // there's no good way to detect touchscreen preference other than receiving a touch event (really, trust me).
		mouseHandlersAttached: false,

		startPosition: null, // x,y,time where first touch began
		latestPosition: null, // x,y,time where the finger is currently
		previousPosition: null, // x,y,time where the finger was ~100ms ago (for velocity calculation)

		canPreventScrolling: false,

		states: {
			idle: function idleStateInit () {
				this.target = null;
				this.usingTouch = false;
				this.removeMouseHandlers();

				return {
					allowTextSelection: true,
				};
			},

			undecided: function undecidedStateInit () {
				this.target.height = this.target.node.offsetHeight;
				this.target.node.style[transitionPrefix] = '';

				if (!this.dispatch(this.target.originalTarget, 'beforewait')) {
				  if (this.dispatch(this.target.originalTarget, 'beforereorder')) {
					this.setState(this.states.reorder);
				  }
				} else {
					var holdTimer = setTimeout(function(){
						var move = this.getAbsoluteMovement();
						if (this.canPreventScrolling && move.x < 15 && move.y < 25) {
							if (this.dispatch(this.target.originalTarget, 'beforereorder')) {
								this.setState(this.states.reorder);
							}
						}
					}.bind(this), 300);
				}

				return {
					leaveState: function () {
						clearTimeout(holdTimer);
					},

					onMove: function() {
						var move = this.getAbsoluteMovement();

						if (move.x > 20 && move.y < Math.max(100, this.target.height)) {
							if (this.dispatch(this.target.originalTarget, 'beforeswipe')) {
								this.setState(this.states.swipe);
								return false;
							} else {
								this.setState(this.states.idle);
							}
						}
						if (move.y > 20) {
							this.setState(this.states.idle);
						}

						// Chrome likes sideways scrolling :(
						if (move.x > move.y*1.2) return false;
					},

					onLeave: function () {
						this.setState(this.states.idle);
					},

					onEnd: function () {
						var allowDefault = this.dispatch(this.target.originalTarget, 'tap');
						this.setState(this.states.idle);
						return allowDefault;
					},
				};
			},

			swipe: function swipeStateInit () {
				var swipeSuccess = false;
				var container = this.container;

				container.className += ' slip-swiping-container';
				function removeClass() {
					container.className = container.className.replace(/(?:^| )slip-swiping-container/,'');
				}

				this.target.height = this.target.node.offsetHeight;

				return {
					leaveState: function () {
						if (swipeSuccess) {
							this.animateSwipe(function(target){
								target.node.style[transformPrefix] = target.baseTransform.original;
								target.node.style[transitionPrefix] = '';
								if (this.dispatch(target.node, 'afterswipe')) {
									removeClass();
									return true;
								} else {
									this.animateToZero(undefined, target);
								}
							}.bind(this));
						} else {
							this.animateToZero(removeClass);
							this.dispatch(this.target.node, 'cancelswipe');
						}
					},

					onMove: function () {
						var move = this.getTotalMovement();

						if (Math.abs(move.y) < this.target.height+20) {
							this.target.node.style[transformPrefix] = 'translate(' + move.x + 'px,0) ' + hwLayerMagic + this.target.baseTransform.value;
							return false;
						} else {
							this.setState(this.states.idle);
						}
					},

					onLeave: function () {
						this.state.onEnd.call(this);
					},

					onEnd: function () {
						var dx = this.latestPosition.x - this.previousPosition.x;
						var dy = this.latestPosition.y - this.previousPosition.y;
						var velocity = Math.sqrt(dx*dx + dy*dy) / (this.latestPosition.time - this.previousPosition.time + 1);

						var move = this.getAbsoluteMovement();
						var swiped = velocity > 0.6 && move.time > 110;

						var direction;
						if (dx > 0) {
							direction = "right";
						} else {
							direction = "left";
						}

						if (swiped) {
							if (this.dispatch(this.target.node, 'swipe', {direction: direction})) {
								swipeSuccess = true; // can't animate here, leaveState overrides anim
							}
						}
						this.setState(this.states.idle);
						return !swiped;
					},
				};
			},

			reorder: function reorderStateInit () {
				this.target.height = this.target.node.offsetHeight;

				var originalIndex = 0;
				var listCount = 0;
				var mouseOutsideTimer;
				var zero = this.target.node.offsetTop + this.target.height/2;
				var otherNodes = [];
				var nodes = this.container.childNodes;
				for(var i=0; i < nodes.length; i++) {

					if (nodes[i].nodeType === 1) {
						listCount++;
						if (nodes[i] === this.target.node) {
							originalIndex = listCount-1;
						}
					}

					if (nodes[i].nodeType != 1 || nodes[i] === this.target.node) continue;
					var t = nodes[i].offsetTop;
					nodes[i].style[transitionPrefix] = transformProperty + ' 0.2s ease-in-out';
					otherNodes.push({
						node: nodes[i],
						baseTransform: getTransform(nodes[i]),
						pos: t + (t < zero ? nodes[i].offsetHeight : 0) - zero,
					});
				}

				this.target.node.className += ' slip-reordering';
				this.target.node.style.zIndex = '99999';
				this.target.node.style[userSelectPrefix] = 'none';
				if (compositorDoesNotOrderLayers) {
					// Chrome's compositor doesn't sort 2D layers
					this.container.style.webkitTransformStyle = 'preserve-3d';
				}

				function setPosition () {
					/*jshint validthis:true */

					if (mouseOutsideTimer) {
						// don't care where the mouse is as long as it moves
						clearTimeout(mouseOutsideTimer); mouseOutsideTimer = null;
					}

					var move = this.getTotalMovement();
					this.target.node.style[transformPrefix] = 'translate(0,' + move.y + 'px) ' + hwTopLayerMagic + this.target.baseTransform.value;

					var height = this.target.height;
					otherNodes.forEach(function(o){
						var off = 0;
						if (o.pos < 0 && move.y < 0 && o.pos > move.y) {
							off = height;
						}
						else if (o.pos > 0 && move.y > 0 && o.pos < move.y) {
							off = -height;
						}
						// FIXME: should change accelerated/non-accelerated state lazily
						o.node.style[transformPrefix] = off ? 'translate(0,'+off+'px) ' + hwLayerMagic + o.baseTransform.value : o.baseTransform.original;
					});
					return false;
				}

				setPosition.call(this);

				return {
					leaveState: function () {
						if (mouseOutsideTimer) clearTimeout(mouseOutsideTimer);

						if (compositorDoesNotOrderLayers) {
							this.container.style.webkitTransformStyle = '';
						}

						this.target.node.className = this.target.node.className.replace(/(?:^| )slip-reordering/,'');
						this.target.node.style[userSelectPrefix] = '';

						this.animateToZero(function(target){
							target.node.style.zIndex = '';
						});
						otherNodes.forEach(function(o){
							o.node.style[transformPrefix] = o.baseTransform.original;
							o.node.style[transitionPrefix] = ''; // FIXME: animate to new position
						});
					},

					onMove: setPosition,

					onLeave: function () {
						// don't let element get stuck if mouse left the window
						// but don't cancel immediately as it'd be annoying near window edges
						if (mouseOutsideTimer) clearTimeout(mouseOutsideTimer);
						mouseOutsideTimer = setTimeout(function(){
							mouseOutsideTimer = null;
							this.cancel();
						}.bind(this), 700);
					},

					onEnd: function () {
						var move = this.getTotalMovement();
						if (move.y < 0) {
							for(var i=0; i < otherNodes.length; i++) {
								if (otherNodes[i].pos > move.y) {
									this.dispatch(this.target.node, 'reorder', {spliceIndex:i, insertBefore:otherNodes[i].node, originalIndex: originalIndex});
									break;
								}
							}
						} else {
							for(var i=otherNodes.length-1; i >= 0; i--) {
								if (otherNodes[i].pos < move.y) {
									this.dispatch(this.target.node, 'reorder', {spliceIndex:i+1, insertBefore:otherNodes[i+1] ? otherNodes[i+1].node : null, originalIndex: originalIndex});
									break;
								}
							}
						}
						this.setState(this.states.idle);

						return false;
					},
				};
			},
		},

		attach: function (container) {
			globalInstances++;
			if (this.container) this.detach();

			// In some cases taps on list elements send *only* click events and no touch events. Spotted only in Chrome 32+
			// Having event listener on body seems to solve the issue (although AFAIK may disable smooth scrolling as a side-effect)
			if (!attachedBodyHandlerHack && needsBodyHandlerHack) {
				attachedBodyHandlerHack = true;
				document.body.addEventListener('touchstart', nullHandler, false);
			}

			this.container = container;
			this.otherNodes = [];

			// selection on iOS interferes with reordering
			document.addEventListener("selectionchange", this.onSelection, false);

			// cancel is called e.g. when iOS detects multitasking gesture
			this.container.addEventListener('touchcancel', this.cancel, false);
			this.container.addEventListener('touchstart', this.onTouchStart, false);
			this.container.addEventListener('touchmove', this.onTouchMove, false);
			this.container.addEventListener('touchend', this.onTouchEnd, false);
			this.container.addEventListener('mousedown', this.onMouseDown, false);
			// mousemove and mouseup are attached dynamically
		},

		detach: function () {
			this.cancel();

			this.container.removeEventListener('mousedown', this.onMouseDown, false);
			this.container.removeEventListener('touchend', this.onTouchEnd, false);
			this.container.removeEventListener('touchmove', this.onTouchMove, false);
			this.container.removeEventListener('touchstart', this.onTouchStart, false);
			this.container.removeEventListener('touchcancel', this.cancel, false);

			document.removeEventListener("selectionchange", this.onSelection, false);

			globalInstances--;
			if (!globalInstances && attachedBodyHandlerHack) {
				attachedBodyHandlerHack = false;
				document.body.removeEventListener('touchstart', nullHandler, false);
			}
		},

		setState: function (newStateCtor) {
			if (this.state) {
				if (this.state.ctor === newStateCtor) return;
				if (this.state.leaveState) this.state.leaveState.call(this);
			}

			// Must be re-entrant in case ctor changes state
			var prevState = this.state;
			var nextState = newStateCtor.call(this);
			if (this.state === prevState) {
				nextState.ctor = newStateCtor;
				this.state = nextState;
			}
		},

		findTargetNode: function (targetNode) {
			while (targetNode && targetNode.parentNode !== this.container) {
				targetNode = targetNode.parentNode;
			}
			return targetNode;
		},

		onSelection: function (e) {
			var isRelated = e.target === document || this.findTargetNode(e);
			if (!isRelated) return;

			if (e.cancelable || e.defaultPrevented) {
				if (!this.state.allowTextSelection) {
					e.preventDefault();
				}
			} else {
				// iOS doesn't allow selection to be prevented
				this.setState(this.states.idle);
			}
		},

		addMouseHandlers: function () {
			// unlike touch events, mousemove/up is not conveniently fired on the same element,
			// but I don't need to listen to unrelated events all the time
			if (!this.mouseHandlersAttached) {
				this.mouseHandlersAttached = true;
				document.documentElement.addEventListener('mouseleave', this.onMouseLeave, false);
				window.addEventListener('mousemove', this.onMouseMove, true);
				window.addEventListener('mouseup', this.onMouseUp, true);
				window.addEventListener('blur', this.cancel, false);
			}
		},

		removeMouseHandlers: function () {
			if (this.mouseHandlersAttached) {
				this.mouseHandlersAttached = false;
				document.documentElement.removeEventListener('mouseleave', this.onMouseLeave, false);
				window.removeEventListener('mousemove', this.onMouseMove, true);
				window.removeEventListener('mouseup', this.onMouseUp, true);
				window.removeEventListener('blur', this.cancel, false);
			}
		},

		onMouseLeave: function (e) {
			if (this.usingTouch) return;

			if (e.target === document.documentElement || e.relatedTarget === document.documentElement) {
				if (this.state.onLeave) {
					this.state.onLeave.call(this);
				}
			}
		},

		onMouseDown: function (e) {
			if (this.usingTouch || e.button != 0 || !this.setTarget(e)) return;

			this.addMouseHandlers(); // mouseup, etc.

			this.canPreventScrolling = true; // or rather it doesn't apply to mouse

			this.startAtPosition({
				x: e.clientX,
				y: e.clientY,
				time: e.timeStamp,
			});
		},

		onTouchStart: function (e) {
			this.usingTouch = true;
			this.canPreventScrolling = true;

			// This implementation cares only about single touch
			if (e.touches.length > 1) {
				this.setState(this.states.idle);
				return;
			}

			if (!this.setTarget(e)) return;

			this.startAtPosition({
				x: e.touches[0].clientX,
				y: e.touches[0].clientY - window.scrollY,
				time: e.timeStamp,
			});
		},

		setTarget: function (e) {
			var targetNode = this.findTargetNode(e.target);
			if (!targetNode) {
				this.setState(this.states.idle);
				return false;
			}

			//check for a scrollable parent
			var scrollContainer = targetNode.parentNode;
			while (scrollContainer){
			  if (scrollContainer.scrollHeight > scrollContainer.clientHeight && window.getComputedStyle(scrollContainer)['overflow-y'] != 'visible') break;
			  else scrollContainer = scrollContainer.parentNode;
			}

			this.target = {
				originalTarget: e.target,
				node: targetNode,
				scrollContainer: scrollContainer,
				baseTransform: getTransform(targetNode),
			};
			return true;
		},

		startAtPosition: function (pos) {
			this.startPosition = this.previousPosition = this.latestPosition = pos;
			this.setState(this.states.undecided);
		},

		updatePosition: function (e, pos) {
			this.latestPosition = pos;

			var triggerOffset = 40,
				offset = 0;

			var scrollable = this.target.scrollContainer || document.body,
				containerRect = scrollable.getBoundingClientRect(),
				targetRect = this.target.node.getBoundingClientRect(),
				bottomOffset = Math.min(containerRect.bottom, window.innerHeight) - targetRect.bottom,
				topOffset = targetRect.top - Math.max(containerRect.top, 0);

			if (bottomOffset < triggerOffset){
			  offset = triggerOffset - bottomOffset;
			}
			else if (topOffset < triggerOffset){
			  offset = topOffset - triggerOffset;
			}

			var prevScrollTop = scrollable.scrollTop;
			scrollable.scrollTop += offset;
			if (prevScrollTop != scrollable.scrollTop) this.startPosition.y += prevScrollTop-scrollable.scrollTop;

			if (this.state.onMove) {
				if (this.state.onMove.call(this) === false) {
					e.preventDefault();
				}
			}

			// sample latestPosition 100ms for velocity
			if (this.latestPosition.time - this.previousPosition.time > 100) {
				this.previousPosition = this.latestPosition;
			}
		},

		onMouseMove: function (e) {
			this.updatePosition(e, {
				x: e.clientX,
				y: e.clientY,
				time: e.timeStamp,
			});
		},

		onTouchMove: function (e) {
			this.updatePosition(e, {
				x: e.touches[0].clientX,
				y: e.touches[0].clientY - window.scrollY,
				time: e.timeStamp,
			});

			// In Apple's touch model only the first move event after touchstart can prevent scrolling (and event.cancelable is broken)
			this.canPreventScrolling = false;
		},

		onMouseUp: function (e) {
			if (this.usingTouch || e.button !== 0) return;

			if (this.state.onEnd && false === this.state.onEnd.call(this)) {
				e.preventDefault();
			}
		},

		onTouchEnd: function (e) {
			if (e.touches.length > 1) {
				this.cancel();
			} else if (this.state.onEnd && false === this.state.onEnd.call(this)) {
				e.preventDefault();
			}
		},

		getTotalMovement: function () {
			return {
				x:this.latestPosition.x - this.startPosition.x,
				y:this.latestPosition.y - this.startPosition.y,
			};
		},

		getAbsoluteMovement: function () {
			return {
				x: Math.abs(this.latestPosition.x - this.startPosition.x),
				y: Math.abs(this.latestPosition.y - this.startPosition.y),
				time:this.latestPosition.time - this.startPosition.time,
			};
		},

		dispatch: function (targetNode, eventName, detail) {
			var event = document.createEvent('CustomEvent');
			if (event && event.initCustomEvent) {
				event.initCustomEvent('slip:' + eventName, true, true, detail);
			} else {
				event = document.createEvent('Event');
				event.initEvent('slip:' + eventName, true, true);
				event.detail = detail;
			}
			return targetNode.dispatchEvent(event);
		},

		getSiblings: function (target) {
			var siblings = [];
			var tmp = target.node.nextSibling;
			while(tmp) {
				if (tmp.nodeType == 1) siblings.push({
					node: tmp,
					baseTransform: getTransform(tmp),
				});
				tmp = tmp.nextSibling;
			}
			return siblings;
		},

		animateToZero: function (callback, target) {
			// save, because this.target/container could change during animation
			target = target || this.target;

			target.node.style[transitionPrefix] = transformProperty + ' 0.1s ease-out';
			target.node.style[transformPrefix] = 'translate(0,0) ' + hwLayerMagic + target.baseTransform.value;
			setTimeout(function(){
				target.node.style[transitionPrefix] = '';
				target.node.style[transformPrefix] = target.baseTransform.original;
				if (callback) callback.call(this, target);
			}.bind(this), 101);
		},

		animateSwipe: function (callback) {
			var target = this.target;
			var siblings = this.getSiblings(target);
			var emptySpaceTransform = 'translate(0,' + this.target.height + 'px) ' + hwLayerMagic + ' ';

			// FIXME: animate with real velocity
			target.node.style[transitionPrefix] = 'all 0.1s linear';
			target.node.style[transformPrefix] = ' translate(' + (this.getTotalMovement().x > 0 ? '' : '-') + '100%,0) ' + hwLayerMagic + target.baseTransform.value;

			setTimeout(function(){
				if (callback.call(this, target)) {
					siblings.forEach(function(o){
						o.node.style[transitionPrefix] = '';
						o.node.style[transformPrefix] = emptySpaceTransform + o.baseTransform.value;
					});
					setTimeout(function(){
						siblings.forEach(function(o){
							o.node.style[transitionPrefix] = transformProperty + ' 0.1s ease-in-out';
							o.node.style[transformPrefix] = 'translate(0,0) ' + hwLayerMagic + o.baseTransform.value;
						});
						setTimeout(function(){
							siblings.forEach(function(o){
								o.node.style[transitionPrefix] = '';
								o.node.style[transformPrefix] = o.baseTransform.original;
							});
						},101);
					}, 1);
				}
			}.bind(this), 101);
		},
	};

	// AMD
	if ('function' === typeof define && define.amd) {
		define(function ( ) {
			return Slip;
		});
	}
	return Slip;
})();

