const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const schema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unqiue: true,
    minlength: 3,
  },
  favouriteGenre: {
    type: String,
    required: true,
    minLength: 3,
  },
});

schema.plugin(uniqueValidator);
module.exports = mongoose.model("User", schema);
