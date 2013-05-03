var	RDB = require('./redis.js'),
	posts = require('./posts.js'),
	utils = require('./utils.js'),
	user = require('./user.js');

(function(Topics) {
	//data structure

	//*global:next_topic_id
	// *tid:1:title
	// *tid:1:uid
	// *tid:1:posts  (array of pid)
	// *tid:1:timestamp
	// *uid:1:tozpics
	// *topic:slug:how-to-eat-chicken:tid



	Topics.get_by_category = function(callback, category, start, end) {

	}


	Topics.generate_topic_body = function(callback, tid, start, end) {
		var topic_body = global.templates['topic'];
	
		posts.get(function(data) {
			topic_body = topic_body.parse(data);
			callback(topic_body);
		}, tid, start, end);
	};

	// this needs to move into forum.js
	Topics.generate_forum_body = function(callback, start, end) {
		var forum_body = global.templates['home'];
		

		Topics.get(function(data) {
			forum_body = forum_body.parse(data);
			callback(forum_body);
		}, start, end);
	};

	Topics.get = function(callback, start, end) {
		if (start == null) start = 0;
		if (end == null) end = start + 10;


		RDB.lrange('topics:tid', start, end, function(tids) {
			var title = [],
				uid = [],
				timestamp = [],
				slug = [],
				postcount = [];

			for (var i=0, ii=tids.length; i<ii; i++) {
				title.push('tid:' + tids[i] + ':title');
				uid.push('tid:' + tids[i] + ':uid');
				timestamp.push('tid:' + tids[i] + ':timestamp');
				slug.push('tid:' + tids[i] + ':slug');
				postcount.push('tid:' + tids[i] + ':postcount');
			}

			if (tids.length > 0) {
				RDB.multi()
					.mget(title)
					.mget(uid)
					.mget(timestamp)
					.mget(slug)
					.mget(postcount)
					.exec(function(err, replies) {
						
						title = replies[0];
						uid = replies[1];
						timestamp = replies[2];
						slug = replies[3];
						postcount = replies[4];
						
						
						
						user.get_usernames_by_uids(uid, function(userNames) {
							var topics = [];
							
							for (var i=0, ii=title.length; i<ii; i++) {
								
								topics.push({
									'title' : title[i],
									'uid' : uid[i],
									'username': userNames[i],
									'timestamp' : timestamp[i],
									'relativeTime': utils.relativeTime(timestamp[i]),
									'slug' : slug[i],
									'post_count' : postcount[i]
								});
							}
						
							callback({'topics': topics});
						});

						
					}
				);
			} else callback([]);
		});
	}

	Topics.post = function(socket, uid, title, content, category) {
		
		if (uid === 0) {
			socket.emit('event:alert', {
				title: 'Thank you for posting',
				message: 'Since you are unregistered, your post is awaiting approval. Click here to register now.',
				type: 'warning',
				timeout: 7500,
				clickfn: function() {
					ajaxify.go('register');
				}
			});
			return; // for now, until anon code is written.
		}
		
		RDB.incr('global:next_topic_id', function(tid) {

			// Global Topics
			if (uid == null) uid = 0;
			if (uid !== null) {
				RDB.lpush('topics:tid', tid);	
			} else {
				// need to add some unique key sent by client so we can update this with the real uid later
				RDB.lpush('topics:queued:tid', tid);		
			}
			


			if (category) {
				RDB.lpush('topics:' + category + ':tid', tid);
			}

			var slug = tid + '/' + slugify(title);

			// Topic Info
			RDB.set('tid:' + tid + ':title', title);
			RDB.set('tid:' + tid + ':uid', uid);
			RDB.set('tid:' + tid + ':slug', slug);
			RDB.set('tid:' + tid + ':timestamp', new Date().getTime());
			RDB.incr('tid:' + tid + ':postcount');
			
			
			
			RDB.set('topic:slug:' + slug + ':tid', tid);

			// Posts
			posts.create(uid, tid, content, function(pid) {
				RDB.lpush('tid:' + tid + ':posts', pid);
			});


			// User Details - move this out later
			RDB.lpush('uid:' + uid + ':topics', tid);

			socket.emit('event:alert', {
				title: 'Thank you for posting',
				message: 'You have successfully posted. Click here to view your post.',
				type: 'notify',
				timeout: 2000
			});
		});

		
	};

}(exports));


//http://dense13.com/blog/2009/05/03/converting-string-to-slug-javascript/
function slugify(str) {
	str = str.replace(/^\s+|\s+$/g, ''); // trim
	str = str.toLowerCase();

	// remove accents, swap ñ for n, etc
	var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
	var to   = "aaaaeeeeiiiioooouuuunc------";
	for (var i=0, l=from.length ; i<l ; i++) {
		str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
	}

	str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
			.replace(/\s+/g, '-') // collapse whitespace and replace by -
			.replace(/-+/g, '-'); // collapse dashes

	return str;
}
