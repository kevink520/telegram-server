var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var db = require('./database');

passport.use(new LocalStrategy(
  function(username, password, done) {
    var User = mongoose.model('User');
    User.findOne({ username: username, password: password }, function callback(err, user) {
      if (err) {
        console.error(err);
        return done(err);
      }
      if (!user) {
        return done(null, false, { message: 'Incorrect username or password.' });
      }
      return done(null, user);
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  var User = mongoose.model('User');
  User.findOne({ _id: id }, function callback(err, user) {
    if (err) {
      console.error(err);
      return done(err);
    }
    if (!user) {
      return done(null, null);
    }
    return done(null, user);
  });
});

module.exports = passport;