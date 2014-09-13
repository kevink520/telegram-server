var mongoose = require('mongoose');
var config = require('./config');
var userSchema = require('./user');
var postSchema = require('./post');

mongoose.connect('mongodb://' + config.DATABASE_HOST + '/' + config.DATABASE_NAME);

mongoose.connection.model('User', userSchema);
mongoose.connection.model('Post', postSchema);

module.exports = mongoose.connection;
