var express = require('express');
var logger = require('nlogger').logger(module);
var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var md5 = require('MD5');
var fs = require('fs');
var Handlebars = require('handlebars');
var passport = require('../../authentication/auth');
var config = require('../../config/config');
var mailgun = require('mailgun-js')({ 
  apiKey: config.API_KEY, 
  domain: config.DOMAIN
});
var router = express.Router();

function returnUserToClient(user, currentUser) {
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

router.post('/', function(req, res) {
  logger.info('The server received a POST request to add a user with the following username: ' + req.body.user.username);
  bcrypt.genSalt(10, function(err, salt) {
    if (err) {
      logger.error('An error occurred while generating a salt using bcrypt. ' + err);
      return res.status(500).end();
    }
    bcrypt.hash(req.body.user.password, salt, function(err, hash) {
      if (err) {
        logger.error('An error occurred while hashing the password using bcrypt. ' + err);
        return res.status(500).end();
      }
      var User = mongoose.model('User');
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
          logger.error('An error occurred while saving the user to the database. ' + err);
          return res.status(500).end();
        }
        logger.info('The server successfully added the user with the username ' + user.username + '.');
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
});

function addProfiledUserAsFollowee(req, res, User) {
  User.update({
    _id: req.user._id
  }, {
    $addToSet: {
      follows: req.params._id
    }
  }, null, function(err, numAffected) {
    if (err) {
      logger.error('An error occurred while updating the current user\'s follows field. ' + err);
      return res.status(500).end();
    }
    if (numAffected) {
      logger.info('The server successfully added the profiled user\'s _id to the current user\'s follows field.');
    } else {
      logger.error('No current user\'s record was updated in the database.');
      return res.status(500).end();
    }
  });
}

function addCurrentUserAsFollower(req, res, User) {
  User.update({
    _id: req.params._id 
  }, {
    $addToSet: {
      followedBy: req.user._id
    }
  }, null, function(err, numAffected) {
    if (err) {
      logger.error('An error occurred while updating the profiled user\'s followedBy field. ' + err);
      return res.status(500).end();
    }
    if (numAffected) {
      logger.info('The server successfully added the current user\'s _id to the profiled user\'s followedBy field.');
    } else {
      logger.error('No profiled user\'s record was updated in the database.');
      return res.status(500).end();
    }
  });
}

function returnUpdatedUser(req, res, User) {
  User.findOne({
    _id: req.params._id 
  }, function(err, user) {
    if (err) {
      logger.error('An error occurred while retrieving the updated profiled user with an _id from the database. ' + err);
      return res.status(500).end();
    }
    if (!user) {
      logger.error('No updated profiled user was found for the _id ' + req.params._id);
      return res.status(404).end();
    }
    logger.info('The server successfully retrieved and sent the updated profiled user with _id ' + user._id + '.');
    return res.send({ 
      'user': returnUserToClient(user, req.user) 
    });
  });
}

function removeProfiledUserFromFollowees(req, res, User) {
  User.update({
    _id: req.user._id
  }, {
    $pull: {
      follows: req.params._id
    }
  }, {
    multi: true
  }, function(err, numAffected) {
    if (err) {
      logger.error('An error occurred while removing the profiled user\'s _id from the current user\'s follows field. ' + err);
      return res.status(500).end();
    }
    if (numAffected) {
      logger.info('The server successfully removed the profiled user\'s _id from the current user\'s follows field.');
    } else {
      logger.error('No current user\'s record was updated in the database.');
      return res.status(500).end();
    }
  });
}

function removeCurrentUserFromFollowers(req, res, User) {
  var User = mongoose.model('User');
  User.update({
    _id: req.params._id
  }, {
    $pull: {
      followedBy: req.user._id
    }
  }, {
    multi: true
  }, function(err, numAffected) {
    if (err) {
      logger.error('An error occurred while updating the profiled user\'s followedBy field. ' + err);
      return res.status(500).end();
    }
    if (numAffected) {
      logger.info('The server successfully removed the current user from the profiled user\'s followedBy field.');
    } else {
      logger.error('No profiled user\'s record was updated in the database.');
      return res.status(500).end();
    }
  });
}

router.put('/:_id', function(req, res) {
  logger.info('The server received a PUT request for a user with the following _id: ' + req.params._id);
  if (!req.user) {
    logger.error('No authenticated user was found, and the follower/followee information was not updated.');
    return res.status(500).end();
  }
  var User = mongoose.model('User');
  if (req.body.user.followedByCurrentUser) {
    addProfiledUserAsFollowee(req, res, User);
    addCurrentUserAsFollower(req, res, User);
    returnUpdatedUser(req, res, User);
  } else if (req.body.user.followedByCurrentUser === false) {
    removeProfiledUserFromFollowees(req, res, User);
    removeCurrentUserFromFollowers(req, res, User);
    returnUpdatedUser(req, res, User);
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
    logger.info('No authenticated user was found, and an empty object was returned to the client.');
    return res.send({
      'users': []
    });
  }
}

function handleQueryByUsenameAndPassword(req, res, next) {
  logger.info('The server received a GET request for a user with the username ' + req.query.username + ' and a password.');
  passport.authenticate('local', function(err, user, info) {
    if (err) { 
      logger.error('An error occurred while authenticating the user with the username ' + req.query.username + ' and a password. ' + err);
      return res.status(500).end(); 
    }
    if (!user) { 
      return res.status(404).end(); 
    }
    req.login(user, function(err) {
      if (err) { 
        logger.error('An error occurred while logging in with username ' + user.username + ' and the password. ' + err);
        return next(err); 
      }
      logger.info('Login with username ' + user.username + ' and the password was successful.');
      return res.send({
        'users': [returnUserToClient(user, req.user)]
      }); 
    });
  })(req, res, next);
}

function handleQueryByUsernameRequest(req, res) {
  logger.info('The server received a GET request for a user with the req.query.username ' + req.query.username);
  var User = mongoose.model('User');
  User.findOne({ 
    username: req.query.username 
  }, function(err, user) {
    if (err) {
      logger.error('An error occurred while finding the user with the req.query.username ' + req.query.username + ' from the database. ' + err);
      return res.status(500).end();
    }
    if (user) {
      logger.info('The server successfully retrieved and sent the user with the req.query.username ' + req.query.username);
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
  var User = mongoose.model('User');
  User.findOne({ 
    email: req.query.email 
  }, function(err, user) {
    if (err) {
      logger.error('An error occurred while finding the user with an email. ' + err);
      return res.status(500).end();
    }
    if (user) {
      logger.info('The server successfully retrieved the user with the email ' + req.query.email);
      var newPassword = Math.random().toString(36).slice(-8);
      var salt = user.username + 'telegramApp2014';
      var md5Password = md5(salt + newPassword);
      bcrypt.genSalt(10, function(err, salt) {
        if (err) {
          logger.error('An error occurred while generating a salt using bcrypt. ' + err);
          return res.status(500).end();
        }
        bcrypt.hash(md5Password, salt, function(err, hash) {
          if (err) {
            logger.error('An error occurred while hashing the password using bcrypt. ' + err);
            return res.status(500).end();
          }
          User.update({
            _id: user._id
          }, {
            $set: {
              password: hash
            }
          }, null, function(err, numAffected) {
            if (err) {
              logger.error('An error occurred while resetting the user\'s password in the database. ' + err);
              return res.status(500).end();
            }
            if (numAffected) {
              logger.info('Successfully reset password.');
              fs.readFile(__dirname + '/../../emails/password-email-template.hbs', function(err, data) {
                if (err) {
                  logger.error('An error occurred while reading the email template. ' + err);
                  return res.status(500).end();
                }
                var source = data.toString();
                var template = Handlebars.compile(source);
                var passwordData = { 
                  password: newPassword 
                };
                var html = template(passwordData);
                var emailData = {
                  from: 'The Telegram App Team <kevinkim75@gmail.com>',
                  to: user.email,
                  subject: 'Your New Password for the Telegram App',
                  html: html
                };

                mailgun.messages().send(emailData, function(err, body) {
                  if (err) {
                    logger.error('An error occurred while sending the email containing the new password to the user. ' + err);
                    return res.status(500).end();
                  }
                  logger.info(body);
                  return res.send({ 
                    'users': [returnUserToClient(user, null)] 
                  });
                });
              });               
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

function handleQueryByFollowedBy(req, res) {
  logger.info('The server received a GET request for all followees of the profiled user.');
  var User = mongoose.model('User');
  User.findById(req.query.followedBy, 'follows', function(err, user) {
    if (err) {
      logger.error('An error occurred while retrieving the profiled user\'s follows array. ' + err);
      return res.status(500).end();
    }
    if (!user) {
      logger.error('The server found no user with the provided profiled user id. The server returned a 404 status code.');
      return res.status(404).end();
    }
    logger.info('The server successfully found a user object with provided profiled user id.');
    if (!user.follows) {
      logger.error('The server found no follows array for the profiled user. The server returned a 404 status code.');
      return res.status(404).end();
    }
    if (!user.follows.length) {
      logger.info('The profiled user has no followees. The server returned an object with an empty array for the users field.');
      return res.send({
        users: []
      });
    }
    var orQueryArray = user.follows.map(function(followeeId) {
      return {
        _id: followeeId
      };
    });
    User.find({
      $or: orQueryArray
    }, function(err, users) {
      if (err) {
        logger.error('An error occurred while retrieving followees of the profiled user.');
        return res.status(500).end();
      }
      logger.info('The server successfully retrieved and sent all followees of the profiled user.');
      return res.send({
        users: users
      });
    });
  });
}

function handleQueryByFollows(req, res) {
  logger.info('The server received a GET request for all followers of the profiled user.');
  var User = mongoose.model('User');
  User.findById(req.query.follows, 'followedBy', function(err, user) {
    if (err) {
      logger.error('An error occurred while finding the user object containing followedBy array for the profiled user.');
      return res.status(500).end();
    }
    if (!user) {
      logger.error('The server found no user with the provided _id for the profiled user. The server returned a 404 status code.');
      return res.status(404).end();
    }
    if (!user.followedBy) {
      logger.error('The server found no followedBy array for the profiled user. The server returned a 404 status code.');
      return res.status(404).end();
    }
    if (!user.followedBy.length) {
      logger.info('The profiled user has no followers. The server returned an object with an empty array for the users field.');
      return res.send({
        users: []
      });
    }
    var orQueryArray = user.followedBy.map(function(followerId) {
      return {
        _id: followerId
      };
    });
    User.find({
      $or: orQueryArray
    }, function(err, users) {
      if (err) {
        logger.error('An error occurred while retrieving the followers of the profiled user.');
        res.status(500).end();
      }
      logger.info('The server successfully retrieved and sent all followers of the profiled user.');
      res.send({
        users: users
      });
    });
  });
}

function handleRequestForAllUsers(req, res) {
  logger.info('The server received a GET request for all users.');
  var User = mongoose.model('User');
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
}

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
    handleQueryByFollowedBy(req, res);
  } else if (req.query.follows) {
    handleQueryByFollows(req, res);
  } else {
    handleRequestForAllUsers(req, res);
  }
});

router.get('/:_id', function(req, res) {
  logger.info('The server received a GET request for a user with the following _id: ' + req.params._id);
  var User = mongoose.model('User');
  User.findOne({
    _id: req.params._id 
  }, function(err, user) {
    if (err) {
      logger.error('An error occurred while retrieving a user with an _id from the database. ' + err);
      return res.status(500).end();
    }
    if (!user) {
      logger.error('No user was found for the _id ' + req.params._id);
      return res.status(404).end();
    }
    logger.info('The server successfully retrieved and sent the user with _id ' + user._id + '.');
    return res.send({ 
      'user': returnUserToClient(user, req.user) 
    });
  });
});

/*router.get('/:username', function(req, res) {
  logger.info('The server received a GET request for a user with the following req.params.username: ' + req.params.username);
  var User = mongoose.model('User');
  User.findOne({ 
    username: req.params.username 
  }, function findCallback(err, user) {
    if (err) {
      logger.error(err);
      return res.status(500).end();
    }
    if (!user) {
      logger.error('No user was found for the username ' + req.params.username);
      return res.status(404).end();
    }
    logger.info('The server successfully retrieved and sent the user with the req.params.username ' + user.username + '.');
    user.password = '';
    return res.send({ 
      'user': user 
    });
  });
});*/

module.exports = router;
