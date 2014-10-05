var express = require('express');
var logger = require('nlogger').logger(module);
var mongoose = require('mongoose');
var async = require('async');
var bcrypt = require('bcrypt');
var md5 = require('MD5');
var sendEmail = require('../../emails/send-email.js');
var passport = require('../../authentication/auth');
var router = express.Router();
var User = mongoose.model('User');

function isFollowedByCurrentUser(user, currentUser) {
  if (!currentUser) {
    return false;
  }
  if (user.followedBy.indexOf(currentUser._id) != -1) {
    return true;
  } else {
    return false;
  }
}

function returnUserToClient(user, currentUser) {
  var modifiedUser = {
    '_id': user._id,
    'username': user.username,
    'name': user.name,
    'password': '',
    'email': user.email,
    'photo': user.photo,
    'followedByCurrentUser': isFollowedByCurrentUser(user, currentUser)
  };
  return modifiedUser;
}

function createAndSaveUser(req, res, hash) {
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
      logger.error('An error occurred while saving the user to the database. ' 
        + err);
      res.status(500).end();
    } else {
      logger.info('The server successfully added the user with the username ' 
        + user.username + '.');
      return user;
    }
  });
}

router.post('/', function(req, res) {
  logger.info('The server received a POST request to add a user with the ' 
    + 'following username: ' + req.body.user.username);
  bcrypt.genSalt(10, function(err, salt) {
    if (err) {
      logger.error('An error occurred while generating a salt using bcrypt. ' 
        + err);
      return res.status(500).end();
    }
    bcrypt.hash(req.body.user.password, salt, function(err, hash) {
      if (err) {
        logger.error('An error occurred while hashing the password using ' 
          + 'bcrypt. ' + err);
        return res.status(500).end();
      }

      var user = createAndSaveUser(req, res, hash);
      
      req.login(user, function(err) {
        if (err) {
          return next(err);
        }
        logger.info('The server established a session.');
        res.status(200).send({
          'user': returnUserToClient(user, req.user)
        });
      });
    });
  });
});

function addProfiledUserAsFollowee(loggedInUserId, profiledUserId, callback) {
  User.findByIdAndUpdate(loggedInUserId, {
    $addToSet: {
      follows: profiledUserId
    }
  }, function(err, numAffected) {
    if (err) {
      logger.error('An error occurred while updating the current user\'s ' 
        + 'follows field. ' + err);
      return callback(err);
    }
    if (numAffected) {
      logger.info('The server successfully added the profiled user\'s _id to ' 
        + 'the current user\'s follows field.');
    } else {
      logger.error('No current user\'s record was updated in the database.');
      callback(null);
    }
  });
}

function addCurrentUserAsFollower(loggedInUserId, profiledUserId, callback) {
  User.findByIdAndUpdate(profiledUserId, {
    $addToSet: {
      followedBy: loggedInUserId
    }
  }, function(err, numAffected) {
    if (err) {
      logger.error('An error occurred while updating the profiled user\'s ' 
        + 'followedBy field. ' + err);
      callback(err);
    }
    if (numAffected) {
      logger.info('The server successfully added the current user\'s _id to ' 
        + 'the profiled user\'s followedBy field.');
    } else {
      logger.error('No profiled user\'s record was updated in the database.');
      callback(null);
    }
  });
}

function returnUpdatedUser(req, res) {
  User.findById(req.params._id, function(err, user) {
    if (err) {
      logger.error('An error occurred while retrieving the updated profiled ' 
        + 'user with an _id from the database. ' + err);
    }
    if (!user) {
      logger.error('No updated profiled user was found for the _id ' 
        + req.params._id);
    }
    logger.info('The server successfully retrieved and sent the updated ' 
      + 'profiled user with _id ' + user._id + '.');
    return res.send({ 
      'user': returnUserToClient(user, req.user) 
    });
  });
}

function removeProfiledUserFromFollowees(loggedInUserId, profiledUserId, 
  callback) {
  User.findByIdAndUpdate(loggedInUserId, {
    $pull: {
      follows: profiledUserId
    }
  }, {
    multi: true
  }, function(err, numAffected) {
    if (err) {
      logger.error('An error occurred while removing the profiled user\'s _id ' 
        + 'from the current user\'s follows field. ' + err);
      callback(err);
    }
    if (numAffected) {
      logger.info('The server successfully removed the profiled user\'s _id ' 
        + 'from the current user\'s follows field.');
    } else {
      logger.error('No current user\'s record was updated in the database.');
    }
    callback(null);
  });
}

function removeCurrentUserFromFollowers(loggedInUserId, profiledUserId, 
  callback) {
  User.findByIdAndUpdate(profiledUserId, {
    $pull: {
      followedBy: loggedInUserId
    }
  }, {
    multi: true
  }, function(err, numAffected) {
    if (err) {
      logger.error('An error occurred while updating the profiled user\'s ' 
        + 'followedBy field. ' + err);
      callback(err);
    }
    if (numAffected) {
      logger.info('The server successfully removed the current user from the ' 
        + 'profiled user\'s followedBy field.');
    } else {
      logger.error('No profiled user\'s record was updated in the database.');
    }
    callback(null);
  });
}

function addUserToFollow(req, res) {
  var loggedInUser = req.user;
  var loggedInUserId = req.user._id;
  var profiledUserId = req.params._id;
  async.parallel([
    function(callback) {
      addProfiledUserAsFollowee(loggedInUserId, profiledUserId, callback);
    },
    function(callback) {
      addCurrentUserAsFollower(loggedInUserId, profiledUserId, callback);
    }
  ], function(err) {
    if (err) {
      logger.error('An error occurred while adding follower/followee ' 
        + 'information to the database.');
      return res.status(500).end();
    }
    returnUpdatedUser(req, res, User);
  });  
}

function removeUserToUnfollow(req, res) {
  var loggedInUser = req.user;
  var loggedInUserId = req.user._id;
  var profiledUserId = req.params._id;
  async.parallel([
    function(callback) {
      removeProfiledUserFromFollowees(loggedInUserId, profiledUserId, User, 
        callback);
    },
    function(callback) {
      removeCurrentUserFromFollowers(loggedInUserId, profiledUserId, User, 
        callback);
    }
  ], function(err) {
    returnUpdatedUser(req, res, User);
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
    addUserToFollow(req, res);
  } else if (req.body.user.followedByCurrentUser === false) {
    removeUserToUnfollow(req, res);
  } else {
    logger.error('No followedByCurrentUser value was provided.');
    res.status(500).end();
  }
});

function handleAuthenticatedUserRequest(req, res) {
  logger.info('The server received a GET request for an authenticated user');
  if (req.isAuthenticated && req.user) {
    return res.send({
      'users': [returnUserToClient(req.user)]
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

function handleQueryByUsenameAndPassword(req, res, next) {
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
        'users': [returnUserToClient(user, req.user)]
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
        'users': [returnUserToClient(user, req.user)] 
      });
    } else {
      logger.info('No user was found for the username ' + req.query.username);
      return res.status(404).end();
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
      var newPassword = Math.random().toString(36).slice(-8);
      var salt = user.username + 'telegramApp2014';
      var md5Password = md5(salt + newPassword);
      bcrypt.genSalt(10, function(err, salt) {
        if (err) {
          logger.error('An error occurred while generating a salt using bcrypt. ' 
            + err);
          return res.status(500).end();
        }
        bcrypt.hash(md5Password, salt, function(err, hash) {
          if (err) {
            logger.error('An error occurred while hashing the password using ' 
              + 'bcrypt. ' + err);
            return res.status(500).end();
          }
          User.findByIdAndUpdate(user._id, {
            $set: {
              password: hash
            }
          }, null, function(err, numAffected) {
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
        });
      });
    } else {
      logger.info('No user was found for the email ' + req.query.email);
      return res.status(404).end();
    }
  });
}

function handleRequestForFollowees(req, res) {
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
        users: []
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
        users: users
      });
    });
  });
}

function handleRequestForFollowers(req, res) {
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
        users: []
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
        users: users
      });
    });
  });
}

/*function handleRequestForAllUsers(req, res) {
  logger.info('The server received a GET request for all users.');
  User.find(function findCallback(err, users) {
    if (err) {
      logger.error('An error occurred while retrieving all users from the database. ' + err);
      return res.status(500).end();
    }
    var usersArray = [];
    (users || []).forEach(function(user) {
      usersArray.push(returnUserToClient(user, req.user));
    });
    logger.info('The server successfully retrieved and sent all users.');
    return res.send({ 
      'users': usersArray 
    });
  });
}*/

router.get('/', function(req, res, next) {
  if (req.query.isAuthenticated) {
    handleAuthenticatedUserRequest(req, res);
  } else if (req.query.username && req.query.password) {
    handleQueryByUsenameAndPassword(req, res, next);
  } else if (req.query.username) {
    handleQueryByUsernameRequest(req, res);
  } else if (req.query.email) {
    handleQueryByEmailRequest(req, res);
  } else if (req.query.followedBy) {
    handleRequestForFollowees(req, res);
  } else if (req.query.follows) {
    handleRequestForFollowers(req, res);
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
      'user': returnUserToClient(user, req.user) 
    });
  });
});

module.exports = router;
