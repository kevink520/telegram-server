var express = require('express');
var logger = require('nlogger').logger(module);
var passport = require('passport');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var app = express();

app.use(cookieParser());

app.use(bodyParser.json());

app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: 'telegram app'
}));

app.use(passport.initialize());

app.use(passport.session());

var router = require('./router')(app);

app.use(function(err, req, res, next) {
  logger.error('Error: ' + err);
  res.status(err.status || 500).end();
});

//function generatePostId() {
//  return (+(posts.posts.sort(function(a, b) {
//    if (a.id < b.id) {
//      return -1;
//    } else {
//      return 1;
//    }
//  })[posts.posts.length - 1].id) + 1).toString();
//}

var server = app.listen(3000, function() {
  console.log('Listening on port %d', server.address().port);
});
