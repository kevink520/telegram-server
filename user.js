var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = new Schema({
  username: String,
  name: String,
  password: String,
  email: String,
  photo: String
});
