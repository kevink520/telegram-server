var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var logger = require('nlogger').logger(module);

passport.use(new LocalStrategy(
  function(username, password, done) {
    var User = mongoose.model('User');
    User.findOne({ 
      username: username 
    }, function callback(err, user) {
      if (err) {
        logger.error('An error occurred while finding a user with the username ' 
          + username + ' from the database. ' + err);
        return done(err);
      }
      if (!user) {
        logger.info('Incorrect username or password.');
        return done(null, false, { 
          message: 'Incorrect username or password.' 
        });
      }
      bcrypt.compare(password, user.password, function(err, res) {
        if (err) {
          logger.error('An error occurred while comparing the submitted password' 
            + ' with the password of the user from the database. ' + err);
          return done(err);
        }
        if (!res) {
          logger.info('Incorrect username or password.');
          return done(null, false, {
            message: 'Incorrect username or password.'
          });
        } else {
          return done(null, user);
        }
      });
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  var User = mongoose.model('User');
  User.findOne({ 
    _id: id 
  }, function callback(err, user) {
    if (err) {
      logger.error('An error occurred while finding the user with the _id ' + id 
        + ' from the database. ' + err);
      return done(err);
    }
    if (!user) {
      return done(null, null);
    }
    return done(null, user);
  });
});

module.exports = passport;
