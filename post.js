var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = new Schema({
  author: String,
  body: String,
  createdDate: String
});
