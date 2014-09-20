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

function returnUserToClient(user) {
  var modifiedUser = {
    '_id': user._id,
    'username': user.username,
    'name': user.name,
    'password': '',
    'email': user.email,
    'photo': user.photo
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
        photo: req.body.user.photo
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
            'user': returnUserToClient(user)
          });
        });
      });
    });
  });
});

function handleQueryByAuthentiationStatus(req, res) {
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
        'users': [returnUserToClient(user)]
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
        'users': [returnUserToClient(user)] 
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
            username: user.username
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
                var passwordData = { password: newPassword };
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
                    'users': [returnUserToClient(user)] 
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
      usersArray.push(returnUserToClient(user));
    });
    logger.info('The server successfully retrieved and sent all users.');
    return res.send({ 
      'users': usersArray 
    });
  });
}

router.get('/', function(req, res, next) {
  if (req.query.isAuthenticated) {
    handleQueryByAuthentiationStatus(req, res);
  } else if (req.query.username && req.query.password) {
    handleQueryByUsenameAndPassword(req, res, next);
  } else if (req.query.username) {
    handleQueryByUsernameRequest(req, res);
  } else if (req.query.email) {
    handleQueryByEmailRequest(req, res);
  } else {
    handleRequestForAllUsers(req, res);
  }
});

router.get('/:_id', function(req, res) {
  logger.info('The server received a GET request for a user with the following _id: ' + req.params._id);
  var User = mongoose.model('User');
  User.findOne({
    _id: req.params._id 
  }, function findCallback(err, user) {
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
      'user': returnUserToClient(user) 
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
