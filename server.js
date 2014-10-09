var express = require('express');
var logger = require('nlogger').logger(module);
var passport = require('passport');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var MongoStore = require('connect-mongostore')(session);
var db = require('./database/database');
var app = express();

app.use(cookieParser());

app.use(bodyParser.json());

app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: 'telegram app',
  store: new MongoStore({
    'db': 'telegramSessions'
  })
}));

app.use(passport.initialize());

app.use(passport.session());

var router = require('./router/router')(app);

app.use(function(err, req, res, next) {
  logger.error('Error: ' + err);
  res.status(err.status || 500).end();
});

db.on('error', console.error.bind(console, 'connection error:'));

db.once('open', function() {
  var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
  });
});
