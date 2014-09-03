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

var express = require('express'),
    logger = require('nlogger').logger(module),
    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    session = require('express-session'),
    uuid = require('node-uuid'),
    app = express();

app.use(cookieParser());

app.use(bodyParser.json());

app.use(session({
  resave: true,
  saveUninitialized: true,
  genid: function(req) {
    return uuid.v1();
  },
  secret: 'telegram app'
}));

app.use(passport.initialize());

app.use(passport.session());

app.use(function(err, req, res, next) {
  res.status(500);
  res.send('error', { error: err });
  logger.error('Error: ' + err);
});

passport.use(new LocalStrategy({
    usernameField: 'id'
  },
  function(username, password, done) {
    var foundUser;
    users.users.forEach(function(user) {
      if (user.id == username && user.password == password) {
        foundUser = user; 
      }
    });
    if (!foundUser) {
      return done(null, false, { message: 'Incorrect username or password' });
    } else {
      return done(null, foundUser);
    }
  }
));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated() && req.user.id == req.body.post.author) {
    return next();
  } else {
    return res.status(403).end();
  }
}

app.post('/api/users', function(req, res) {
	var user = req.body.user;
	logger.info('The server received a POST request to add a user with the following user ID: ' + user.id);
	users.users.push(user);
	logger.info('The server successfully added the user with the user ID ' + user.id + '.');
  req.login(user, function(err) {
    if (err) {
      return next(err);
    }
    console.log(req.user);
  });
	res.status(200).send({'user': user});
});

app.get('/api/users', function(req, res, next) {
	if (req.query.isAuthenticated) {
    logger.info('The server received a GET request for an authentcated user');
    if (req.isAuthenticated && req.user) {
      res.send({'users': [req.user]});
      logger.info('The authenticated user was found and returned to the client');
    } else {
      res.send({'users': []});
      logger.info('No authenticated user was found, and an empty object was returned to the client.');
    }
  }
  else if (req.query.id && req.query.password) {
		logger.info('The server received a GET request for a user with the user ID ' + req.query.id + ' and a password.');
    passport.authenticate('local', function(err, user, info) {
      if (err) { 
        return next(err); 
      }
      if (!user) { 
        return res.redirect('/login'); 
      }
      req.login(user, function(err) {
        if (err) { return next(err); }
        logger.info('Login with username ' + user.id + ' and the password was successful.');
        return res.send({'users': [user]}); 
      });
             
    })(req, res, next);
    
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

app.post('/api/posts', ensureAuthenticated, function(req, res) {
  logger.info('The server received a POST request from authenticated author ' + req.body.post.author + ' to add a post.');
  var postId = (+(posts.posts.sort(function(a, b) {
    if (a.id < b.id) {
      return -1;
    } else {
      return 1;
    }
  })[posts.posts.length - 1].id) + 1).toString();
  var post = req.body.post;
  post.id = postId;
  console.log('post id: ' + post.id);
  posts.posts.push(post);
  logger.info('The server successfully added the post with the post ID ' + post.id + '.');
  res.status(200).send({'post': post});
});

app.delete('/api/posts/:id', function(req, res) {
  if (req.params.id) {
  	logger.info('The server received a DELETE request for a post with the following post ID: ' + req.params.id);
    posts.posts.forEach(function(post, index) {
    	if (post.id == req.params.id) {
    		posts.posts.splice(index, 1);
    		logger.info('The server successfully deleted the post with the post ID ' + post.id + '.');
    		res.status(200).send({});
    	}
    });
  }
});

app.get('/api/logout', function(req, res) {
  if (req.query.logout) {
    req.logout();
    res.status(200).send('Success');
  }  
});

var server = app.listen(3000, function() {
  console.log('Listening on port %d', server.address().port);
});
