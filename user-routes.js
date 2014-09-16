var express = require('express');
var logger = require('nlogger').logger(module);
var mongoose = require('mongoose');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt');
var md5 = require('MD5');
var db = require('./database');
var passport = require('./auth');
var template = require('./password-email-template');
var api_key = 'key-636fa3e1ed0b406de09c01ad36cbe112';
var domain = 'sandboxc917541ba8e74525b4d15356f5810e72.mailgun.org';
var mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});
var router = express.Router();

router.post('/', function(req, res) {
  logger.info('The server received a POST request to add a user with the following username: ' + req.body.user.username);
  bcrypt.genSalt(10, function(err, salt) {
    if (err) {
      logger.error(err);
      return res.status(500).end();
    }
    bcrypt.hash(req.body.user.password, salt, function(err, hash) {
      if (err) {
        logger.error(err);
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
          logger.error(err);
          return res.status(500).end();
        }
        logger.info('The server successfully added the user with the username ' + user.username + '.');
        req.login(user, function(err) {
          if (err) {
            return next(err);
          }
          logger.info('The server established a session.');
          user.password = '';
          res.status(200).send({
            'user': user
          });
        });
      });
    });
  });
});

router.get('/', function(req, res, next) {
  if (req.query.isAuthenticated) {
    logger.info('The server received a GET request for an authenticated user');
    if (req.isAuthenticated && req.user) {
      req.user.password = '';
      return res.send({
        'users': [req.user]
      });
      logger.info('The authenticated user was found and returned to the client');
    } else {
      logger.info('No authenticated user was found, and an empty object was returned to the client.');
      return res.send({
        'users': []
      });
    }
  }
  else if (req.query.username && req.query.password) {
    logger.info('The server received a GET request for a user with the username ' + req.query.username + ' and a password.');
    passport.authenticate('local', function(err, user, info) {
      if (err) { 
        return res.status(500).end(); 
      }
      if (!user) { 
        return res.status(404).end(); 
      }
      req.login(user, function(err) {
        if (err) { 
          return next(err); 
        }
        logger.info('Login with username ' + user.username + ' and the password was successful.');
        user.password = '';
        return res.send({
          'users': [user]
        }); 
      });
    })(req, res, next);
  }
  else if (req.query.username) {
    logger.info('The server received a GET request for a user with the req.query.username ' + req.query.username);
    var User = mongoose.model('User');
    User.findOne({ 
      username: req.query.username 
    }, function(err, user) {
      if (err) {
        logger.error(err);
        return res.status(500).end();
      }
      if (user) {
        logger.info('The server successfully retrieved and sent the user with the req.query.username ' + req.query.username);
        user.password = '';
        return res.send({ 
          'users': [user] 
        });
      } else {
        logger.info('No user was found for the username ' + req.query.username);
        return res.status(404).end();
      }
    });
  }
  else if (req.query.email) {
    logger.info('The server received a GET request for a user with an email.');
    var User = mongoose.model('User');
    User.findOne({ 
      email: req.query.email 
    }, function(err, user) {
      if (err) {
        logger.error(err);
        return res.status(500).end();
      }
      if (user) {
        logger.info('The server successfully retrieved the user with the email ' + req.query.email);
        var newPassword = Math.random().toString(36).slice(-8);
        var salt = user.username + 'telegramApp2014';
        var md5Password = md5(salt + newPassword);
        bcrypt.genSalt(10, function(err, salt) {
          if (err) {
            logger.error(err);
            return res.status(500).end();
          }
          bcrypt.hash(md5Password, salt, function(err, hash) {
            if (err) {
              logger.error(err);
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
                logger.error(err);
                return res.status(500).end();
              }
              if (numAffected) {
                logger.info('Successfully reset password.');
                var passwordData = { password: newPassword };
                var html = template(passwordData);
                var data = {
                  from: 'The Telegram App Team <kevinkim75@gmail.com>',
                  to: user.email,
                  subject: 'Your New Password for the Telegram App',
                  html: html
                };

                mailgun.messages().send(data, function(err, body) {
                  if (err) {
                    logger.error(err);
                    return res.status(500).end();
                  }
                  logger.info(body);
                  user.password = '';
                  return res.send({ 
                    'users': [user] 
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
  else {
    logger.info('The server received a GET request for all users.');
    var User = mongoose.model('User');
    User.find(function findCallback(err, users) {
      if (err) {
        logger.error(err);
        return res.status(500).end();
      }
      var usersArray = [];
      (users || []).forEach(function(user) {
        user.password = '';
        usersArray.push(user);
      });
      logger.info('The server successfully retrieved and sent all users.');
      return res.send({ 
        'users': usersArray 
      });
    });
  }  
});

router.get('/:_id', function(req, res) {
  logger.info('The server received a GET request for a user with the following _id: ' + req.params._id);
  var User = mongoose.model('User');
  User.findOne({
    _id: req.params._id 
  }, function findCallback(err, user) {
    if (err) {
      logger.error(err);
      return res.status(500).end();
    }
    if (!user) {
      logger.error('No user was found for the _id ' + req.params._id);
      return res.status(404).end();
    }
    logger.info('The server successfully retrieved and sent the user with _id ' + user._id + '.');
    user.password = '';
    return res.send({ 
      'user': user 
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
