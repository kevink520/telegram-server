var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var db = require('./database');

passport.use(new LocalStrategy({
    usernameField: 'id'
  },
  function(username, password, done) {
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function callback() {
      var User = mongoose.model('User', userSchema);
      User.findOne({ id: username, password: password }, function callback(err, user) {
        if (err) {
          return console.error(err);
        }
        if (!user) {
          return done(null, false, { message: 'Incorrect username or password.' });
        }
        return done(null, user);
      });
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  users.users.forEach(function(user) {
    if (user.id == id) {
      done(null, user);
    }
  });
});

module.exports = passport;