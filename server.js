var users = {
	'users': [
    { 
      'id': 'cristianstrat',
      'name': 'Cristian Strat', 
      'password': 'cs1234', 
      'email': 'cristianstrat@gmail.com', 
      'photo': 'http://placehold.it/70'
    },
    { 
      'id': 'johnmaeda',
      'name': 'John Maeda',
      'password': 'jm1234',
      'email': 'johnmaeda@gmail.com',
      'photo': 'http://placehold.it/70'
    },
    {
      'id': 'clarkewolfe',
      'name': 'Clarke Wolfe',
      'password': 'cw1234',
      'email': 'clarkewolfe@yahoo.com',
      'photo': 'http://placehold.it/70'
    },
    {
      'id': 'fastcompany',
      'name': 'Fast Company',
      'password': 'fc1234',
      'email': 'info@fastcompany.com',
      'photo': 'http://placehold.it/70'
    }
  ]
};

var posts = {
	'posts': [
	  {
		  'id': '1',
      'author': 'fastcompany',
      'body': 'Leica celebrates 100 years with a georgeously minimalist shooter that pays homage to its first <a href="http://wrd.cm/1ieFplL">http://wrd.cm/1ieFplL</a> <a href="http://pic.twitter.com/SNvy9PGZwc">pic.twitter.com/SNvy9PGZwc</a>',
      'createdDate': new Date(2014, 3, 24, 13, 39, 0).toISOString()    
    },
    {
			'id': '2',
      'author': 'fastcompany',
      'body': 'This app is like a remote control for your credit cards: <a href="http://f-st.co/OXzg2Ew">http://f-st.co/OXzg2Ew</a> <a href="http://pic.twitter.com/eAL1sdVhrh">pic.twitter.com/eAL1sdVhrh</a>',
      'createdDate': new Date(2014, 3, 24, 13, 40, 0).toISOString()
	  },
    {
	  	'id': '3',
      'author': 'clarkewolfe',
      'body': 'Listen, I don&rsquo;t want to brag about my awesome #gaming skills but someone made it into an @IGN article today...',
      'createdDate': new Date(2014, 3, 24, 13, 42, 0).toISOString()
    },
    {
	 		'id': '4',
      'author': 'johnmaeda',
      'body': 'Great teams constantly learn and re-learn how to move from the ego of *I* to the ego of *WE*.',
      'createdDate': new Date(2014, 3, 24, 13, 45, 0).toISOString()
	  },
    {
	 		'id': '5',
      'author': 'cristianstrat',
      'body': 'Ponies enhance cognition. To be safe around horses you must stay focused, alert, aware, and never forget that they can kick your ass.',
      'createdDate': new Date(2014, 3, 24, 13, 50, 0).toISOString()
	  }
  ]
};

var logger = require('nlogger').logger(module),
    express = require('express'),
    bodyParser = require('body-parser'),
    app = express();

app.use(bodyParser.urlencoded({ extended: false }));

app.use(bodyParser.json());

app.use(bodyParser.json({ type: 'application/vnd.api+json' }));

app.use(function(err, req, res, next) {
  res.status(500);
  res.send('error', { error: err });
  logger.error('Error: ' + err);
});

app.post('/api/users', function(req, res) {
	var user = req.body.user;
	logger.info('The server received a POST request to add a user with the following user ID: ' + user.id);
	users.users.push(user);
	logger.info('The server successfully added the user with the user ID ' + user.id + '.');
	res.status(200).end();
});

app.get('/api/users', function(req, res) {
	if (req.query.id && req.query.password) {
		logger.info('The server received a GET request for a user with the user ID ' + req.query.id + ' and a password.');
		users.users.forEach(function(user) {
	    if (user.id == req.query.id && user.password == req.query.password) {
	      res.send({'users': [user]});
	      logger.info('The server successfully retrieved and sent the user with the user ID ' + user.id + ' and the password.');
	    }
		});
	}
	else if (req.query.email) {
		logger.info('The server received a GET request for a user with an email.');
		users.users.forEach(function(user) {
			if (user.email == req.query.email) {
				res.send({'users': [user]});
	      logger.info('The server successfully retrieved and sent the user with the email.');
			}
		});
	}
	else {
		logger.info('The server received a GET request for all users.');
    res.send(users);
    logger.info('The server successfully retrieved and sent all users.');
	}  
});

app.get('/api/users/:id', function(req, res) {
  if (req.params.id) {
		logger.info('The server received a GET request for a user with the following user ID: ' + req.params.id);
		users.users.forEach(function(user) {
      if (user.id == req.params.id) {
        res.send({'user': user});
	      logger.info('The server successfully retrieved and sent the user with the user ID ' + user.id + '.');
      }
		}); 
	}
});

app.get('/api/posts', function(req, res) {
	logger.info('The server received a GET request for all posts.');
  res.send(posts);
  logger.info('The server successfully retrieved and sent all posts.');
});

app.post('/api/posts', function(req, res) {
  var post = req.body.post;
	logger.info('The server received a POST request to add the post with following post ID: ' + post.id);
  posts.posts.push(post);
  logger.info('The server successfully added the post with the post ID ' + post.id + '.');
  res.status(200).end();
});

app.delete('/api/posts/:id', function(req, res) {
  if (req.params.id) {
  	logger.info('The server received a DELETE request for a post with the following post ID: ' + req.params.id);
    posts.posts.forEach(function(post, index) {
    	if (post.id == req.params.id) {
    		posts.posts.splice(index, 1);
    		logger.info('The server successfully deleted the post with the post ID ' + post.id + '.');
    		res.send({});
    	}
    });
  }
});

var server = app.listen(3000, function() {
  console.log('Listening on port %d', server.address().port);
});
