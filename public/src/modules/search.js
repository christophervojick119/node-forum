define('search', ['navigator'], function(nav) {
	"use strict";
	/* globals socket, ajaxify */

	var Search = {
			current: {}
		};

	Search.query = function(term, callback) {
		// Detect if a tid was specified
		var topicSearch = term.match(/in:topic-([\d]+)/);

		if (!topicSearch) {
			term = term.replace(/^[ ?#]*/, '');
			ajaxify.go('search/' + term);
			callback();
		} else {
			var cleanedTerm = term.replace(topicSearch[0], ''),
				tid = topicSearch[1];

			Search.queryTopic(tid, cleanedTerm, callback);
		}
	};

	Search.queryTopic = function(tid, term, callback) {
		socket.emit('topics.search', {
			tid: tid,
			term: term
		}, function(err, pids) {
			callback(err);

			// Sort pids numerically & store
			Search.current = {
				results: pids.sort(function(a, b) {
					return a-b;
				}),
				tid: tid,
				term: term
			};

			Search.topicDOM.update(0);
		});
	};

	Search.checkPagePresence = function(tid, callback) {
		if (!ajaxify.currentPage.match(new RegExp('^topic/' + tid))) {
			ajaxify.go('topic/' + tid, callback);
		} else {
			callback();
		}
	};

	Search.topicDOM = {};
	Search.topicDOM.start = function() {
		var topicSearchEl = $('.topic-search');

		topicSearchEl.find('.count').html('1 / ' + Search.current.results.length);
		topicSearchEl.removeClass('hidden');
		Search.checkPagePresence(Search.current.tid, function() {
			Search.highlightResult(0);
		});
	};

	Search.topicDOM.prev = function() {
		Search.topicDOM.update((Search.current.index === 0) ? Search.current.results.length-1 : Search.current.index-1);
	};

	Search.topicDOM.next = function() {
		Search.topicDOM.update((Search.current.index === Search.current.results.length-1) ? 0 : Search.current.index+1);
	};

	Search.topicDOM.update = function(index) {
		var topicSearchEl = $('.topic-search');

		Search.current.index = index;

		topicSearchEl.find('.count').html((index+1) + ' / ' + Search.current.results.length);
		topicSearchEl.removeClass('hidden');
		Search.checkPagePresence(Search.current.tid, function() {
			socket.emit('posts.getPidIndex', Search.current.results[index], function(err, postIndex) {
				nav.scrollToPost(postIndex-1, true);	// why -1? Ask @barisusakli
			});
		});

	};

	return Search;
});