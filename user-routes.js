var express = require('express');
var logger = require('nlogger').logger(module);
var mongoose = require('mongoose');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var db = require('./database');
var passport = require('./auth');
var router = express.Router();

router.post('/', function(req, res) {
  logger.info('The server received a POST request to add a user with the following user ID: ' + req.body.user.id);
  db.on('error', console.error.bind(console, 'connection error:'));
  db.once('open', function callback() {
    var User = mongoose.model('User', userSchema);
    var user = new User({
      id: req.body.user.id,
      name: req.body.user.name,
      password: req.body.user.password,
      email: req.body.user.email,
      photo: req.body.user.photo
    });
    logger.info('user: ' + user);
    user.save(function saveCallback(err, user) {
      if (err) {
        return console.error(err);
      }
      logger.info('The server successfully added the user with the user ID ' + user.id + '.');
      req.login(user, function(err) {
        if (err) {
          return next(err);
        }
        logger.info('The server established a session.');
        res.status(200).send({'user': user});
      });
    });
  });
});

router.get('/', function(req, res, next) {
  if (req.query.isAuthenticated) {
    logger.info('The server received a GET request for an authentcated user');
    if (req.isAuthenticated && req.user) {
      return res.send({'users': [req.user]});
      logger.info('The authenticated user was found and returned to the client');
    } else {
      logger.info('No authenticated user was found, and an empty object was returned to the client.');
      return res.send({'users': []});
    }
  }
  else if (req.query.id && req.query.password) {
    logger.info('The server received a GET request for a user with the user ID ' + req.query.id + ' and a password.');
    passport.authenticate('local', function(err, user, info) {
      if (err) { 
        return next(err); 
      }
      if (!user) { 
        return res.status(404).end(); 
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
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function callback() {
      var User = mongoose.model('User', userSchema);
      User.findOne({ email: req.query.email }, function findCallback(err, user) {
        if (err) {
          return console.error(err);
        }
        if (user) {
          logger.info('The server successfully retrieved and sent the user with the email.');
          return res.send({ 'users': [user] });
        }
      });
    });
  }
  else {
    logger.info('The server received a GET request for all users.');
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function callback() {
      var User = mongoose.model('User', userSchema);
      User.find(function findCallback(err, users) {
        if (err) {
          return console.error(err);
        }
        logger.info('The server successfully retrieved and sent all users.');
        return res.send({ 'users': [users] });
      });
    });  
  }  
  res.status(404).end();
});

router.get('/:id', function(req, res) {
  logger.info('The server received a GET request for a user with the following user ID: ' + req.params.id);
  db.on('error', console.error.bind(console, 'connection error:'));
  db.once('open', function callback() {
    var User = mongoose.model('User', userSchema);
    User.findOne({ id: req.params.id }, function findCallback(err, user) {
      logger.info('The server successfully retrieved and sent the user with the user ID ' + user.id + '.');
      return res.send({ 'user': user });
    });
  });
  res.status(404).end();
});

module.exports = router;
