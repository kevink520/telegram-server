var express = require('express');
var logger = require('nlogger').logger(module);
var db = require('../../database/database');
var async = require('async');
var md5 = require('MD5');
var UserUtils = require('./user-utils');
var sendEmail = require('../../emails/send-email');
var passport = require('../../authentication/auth');
var router = express.Router();
var User = db.model('User');

function createAndSaveUser(err, req, res, hash, user, newPassword) {
  if (err) {
    return res.status(500).end();
  }

  User.findOne({
    username: req.body.user.username
  }, function(err, userWithSameUsername) {
    if (err) {
      logger.error('An error occurred while checking for a duplicate username. ' +
                   err);
      return res.status(500).end();
    }
    if (userWithSameUsername) {
      logger.error('The username already exists in the database. The server ' +
                   'returned a 422 status code.');
      return res.status(422).end();
    }

    var user = new User({
      username: req.body.user.username,
      name: req.body.user.name,
      password: hash,
      email: req.body.user.email,
      photo: req.body.user.photo,
      followedBy: [],
      follows: []
    });
    user.save(function(err, user) {
      if (err) {
        logger.error('An error occurred while saving the user to the database. ' +
                     err);
        return res.status(500).end();
      } else {
        logger.info('The server successfully added the user with the username ' +
                    user.username + '.');
        establishSession(req, res, user);
      }
    });
  });
}

function establishSession(req, res, user) {
  req.login(user, function(err) {
    if (err) {
      logger.error('An error occurred while establishing a session. ' + err);
      return res.status(500).end();
    }
    logger.info('The server established a session.');
    res.status(200).send({
      'user': UserUtils.emberUser(user, req.user)
    });
  });
}

router.post('/', function(req, res) {
  logger.info('The server received a POST request to add a user with the ' + 
              'following username: ' + req.body.user.username);
  var password = req.body.user.password;
  UserUtils.encryptPassword(req, res, password, null, null, createAndSaveUser);        
});

function sendUserResponse(req, res) {
  User.findById(req.params._id, function(err, user) {
    if (err) {
      logger.error('An error occurred while retrieving the updated profiled ' +
                   'user with an _id from the database. ' + err);
    }
    if (!user) {
      logger.error('No updated profiled user was found for the _id ' +
                   req.params._id);
    }
    logger.info('The server successfully retrieved and sent the updated ' +
                'profiled user with _id ' + user._id + '.');
    return res.send({ 
      'user': UserUtils.emberUser(user, req.user) 
    });
  });
}

function createFollowRelationship(req, res) {
  var loggedInUser = req.user;
  var loggedInUserId = req.user._id;
  var profiledUserId = req.params._id;
  async.parallel([
    function(callback) {
      UserUtils.addUserAsFollowee(loggedInUserId, profiledUserId, callback);
    },
    function(callback) {
      UserUtils.addUserAsFollower(loggedInUserId, profiledUserId, callback);
    }
  ], function(err) {
    if (err) {
      logger.error('An error occurred while adding follower/followee ' +
                   'information to the database.');
      return res.status(500).end();
    }
    sendUserResponse(req, res);
  });  
}

function removeFollowRelationship(req, res) {
  var loggedInUser = req.user;
  var loggedInUserId = req.user._id;
  var profiledUserId = req.params._id;
  async.parallel([
    function(callback) {
      UserUtils.removeUserFromFollowees(loggedInUserId, profiledUserId, User, 
                                        callback);
    },
    function(callback) {
      UserUtils.removeUserFromFollowers(loggedInUserId, profiledUserId, User, 
                                        callback);
    }
  ], function(err) {
    if (err) {
      logger.error('An error occurred while removing user to unfollow. ' + err);
      res.status(500).end();
    }
    sendUserResponse(req, res);
  });
}

router.put('/:_id', function(req, res) {
  logger.info('The server received a PUT request for a user with the following ' 
    + '_id: ' + req.params._id);
  if (!req.user) {
    logger.error('No authenticated user was found, and the follower/followee ' 
      + 'information was not updated.');
    return res.status(500).end();
  }
  if (req.body.user.followedByCurrentUser) {
    createFollowRelationship(req, res);
  } else if (req.body.user.followedByCurrentUser === false) {
    removeFollowRelationship(req, res);
  } else {
    logger.error('No followedByCurrentUser value was provided.');
    res.status(500).end();
  }
});

router.get('/logout', function(req, res) {
  req.logout();
  res.status(200).send('Success');
  logger.info('Successfully logged out user.');
});

function handleAuthenticatedUserRequest(req, res) {
  logger.info('The server received a GET request for an authenticated user');
  if (req.isAuthenticated() && req.user) {
    return res.send({
      'users': [UserUtils.emberUser(req.user)]
    });
    logger.info('The authenticated user was found and returned to the client');
  } else {
    logger.info('No authenticated user was found, and an empty object was ' 
      + 'returned to the client.');
    return res.send({
      'users': []
    });
  }
}

function handleLoginRequest(req, res, next) {
  logger.info('The server received a GET request for a user with the username ' 
    + req.query.username + ' and a password.');
  passport.authenticate('local', function(err, user, info) {
    if (err) { 
      logger.error('An error occurred while authenticating the user with the ' 
        + 'username ' + req.query.username + ' and a password. ' + err);
      return res.status(500).end(); 
    }
    if (!user) { 
      return res.status(404).end(); 
    }
    req.login(user, function(err) {
      if (err) { 
        logger.error('An error occurred while logging in with username ' 
          + user.username + ' and the password. ' + err);
        return next(err); 
      }
      logger.info('Login with username ' + user.username + ' and the password ' 
        + 'was successful.');
      return res.send({
        'users': [UserUtils.emberUser(user, req.user)]
      }); 
    });
  })(req, res, next);
}

function handleQueryByUsernameRequest(req, res) {
  logger.info('The server received a GET request for a user with the ' 
    + 'req.query.username ' + req.query.username);
  User.findOne({ 
    username: req.query.username 
  }, function(err, user) {
    if (err) {
      logger.error('An error occurred while finding the user with the ' 
        + 'req.query.username ' + req.query.username + ' from the database. ' 
        + err);
      return res.status(500).end();
    }
    if (user) {
      logger.info('The server successfully retrieved and sent the user with ' 
        + 'the req.query.username ' + req.query.username);
      return res.send({ 
        'users': [UserUtils.emberUser(user, req.user)] 
      });
    } else {
      logger.info('No user was found for the username ' + req.query.username);
      return res.status(404).end();
    }
  });
}

function createAndUpdatePassword(res, user) {
  var newPassword = Math.random().toString(36).slice(-8);
  var salt = user.username + 'telegramApp2014';
  var md5Password = md5(salt + newPassword);
  UserUtils.encryptPassword(null, res, md5Password, user, newPassword,
                            findUserAndUpdatePassword);
}

function findUserAndUpdatePassword(err, req, res, hash, user, newPassword) {
  if (err) {
    res.status(500).end();
  }
  User.findByIdAndUpdate(user._id, {
    $set: {
      password: hash
    }
  }, function(err, numAffected) {
    if (err) {
      logger.error('An error occurred while resetting the user\'s ' 
        + 'password in the database. ' + err);
      return res.status(500).end();
    }
    if (numAffected) {
      logger.info('Successfully reset password.');
      sendEmail(newPassword, user, res);           
    }
  });
}

function handleQueryByEmailRequest(req, res) {
  logger.info('The server received a GET request for a user with an email.');
  User.findOne({ 
    email: req.query.email 
  }, function(err, user) {
    if (err) {
      logger.error('An error occurred while finding the user with an email. ' 
        + err);
      return res.status(500).end();
    }
    if (user) {
      logger.info('The server successfully retrieved the user with the email ' 
        + req.query.email);
      createAndUpdatePassword(res, user);
    } else {
      logger.info('No user was found for the email ' + req.query.email);
      return res.status(404).end();
    }
  });
}

function handleQueryForFolloweesRequest(req, res) {
  logger.info('The server received a GET request for all followees of the ' 
    + 'profiled user.');
  User.findById(req.query.followedBy, 'follows', function(err, user) {
    if (err) {
      logger.error('An error occurred while retrieving the profiled user\'s ' 
        + 'follows array. ' + err);
      return res.status(500).end();
    }
    if (!user) {
      logger.error('The server found no user with the provided profiled user id.' 
        + ' The server returned a 404 status code.');
      return res.status(404).end();
    }
    logger.info('The server successfully found a user object with provided ' 
      + 'profiled user id.');
    if (!user.follows) {
      logger.error('The server found no follows array for the profiled user. ' 
        + 'The server returned a 404 status code.');
      return res.status(404).end();
    }
    if (!user.follows.length) {
      logger.info('The profiled user has no followees. The server returned an ' 
        + 'object with an empty array for the users field.');
      return res.send({
        'users': []
      });
    }
    var followeeIds = user.follows;
    User.find({
      _id: {
        $in: followeeIds
      }
    }, function(err, users) {
      if (err) {
        logger.error('An error occurred while retrieving followees of the ' 
          + 'profiled user.');
        return res.status(500).end();
      }
      logger.info('The server successfully retrieved and sent all followees of ' 
        + 'the profiled user.');
      return res.send({
        'users': UserUtils.emberUsers(users, req.user)
      });
    });
  });
}

function handleQueryForFollowersRequest(req, res) {
  logger.info('The server received a GET request for all followers of the ' 
    + 'profiled user.');
  User.findById(req.query.follows, 'followedBy', function(err, user) {
    if (err) {
      logger.error('An error occurred while finding the user object containing ' 
        + 'followedBy array for the profiled user.');
      return res.status(500).end();
    }
    if (!user) {
      logger.error('The server found no user with the provided _id for the ' 
        + 'profiled user. The server returned a 404 status code.');
      return res.status(404).end();
    }
    if (!user.followedBy) {
      logger.error('The server found no followedBy array for the profiled user.' 
        + ' The server returned a 404 status code.');
      return res.status(404).end();
    }
    if (!user.followedBy.length) {
      logger.info('The profiled user has no followers. The server returned an ' 
        + 'object with an empty array for the users field.');
      return res.send({
        'users': []
      });
    }
    var followerIds = user.followedBy;
    User.find({
      _id: {
        $in: followerIds
      }
    }, function(err, users) {
      if (err) {
        logger.error('An error occurred while retrieving the followers of the ' 
          + 'profiled user.');
        res.status(500).end();
      }
      logger.info('The server successfully retrieved and sent all followers of ' 
        + 'the profiled user.');
      res.send({
        'users': UserUtils.emberUsers(users, req.user)
      });
    });
  });
}

router.get('/', function(req, res, next) {
  if (req.query.isAuthenticated) {
    handleAuthenticatedUserRequest(req, res);
  } else if (req.query.username && req.query.password) {
    handleLoginRequest(req, res, next);
  } else if (req.query.username) {
    handleQueryByUsernameRequest(req, res);
  } else if (req.query.email) {
    handleQueryByEmailRequest(req, res);
  } else if (req.query.followedBy) {
    handleQueryForFolloweesRequest(req, res);
  } else if (req.query.follows) {
    handleQueryForFollowersRequest(req, res);
  } else {
    logger.error('The server received no query and returned a 404 status code.');
    res.status(404).end();
  }
});

router.get('/:_id', function(req, res) {
  logger.info('The server received a GET request for a user with the following ' 
    + '_id: ' + req.params._id);
  User.findById(req.params._id, function(err, user) {
    if (err) {
      logger.error('An error occurred while retrieving a user with an _id from ' 
        + 'the database. ' + err);
      return res.status(500).end();
    }
    if (!user) {
      logger.error('No user was found for the _id ' + req.params._id);
      return res.status(404).end();
    }
    logger.info('The server successfully retrieved and sent the user with _id ' 
      + user._id + '.');
    return res.send({ 
      'user': UserUtils.emberUser(user, req.user) 
    });
  });
});


module.exports = router;
