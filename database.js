var mongoose = require('mongoose');
var config = require('./config');
var userSchema = require('./user');
var postSchema = require('./post');

mongoose.connect('mongodb://' + config.DATABASE_HOST + '/' + config.DATABASE_NAME);

module.exports = mongoose.connection;
