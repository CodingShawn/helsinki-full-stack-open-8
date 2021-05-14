const { ApolloServer, gql, PubSub } = require("apollo-server");
const mongoose = require("mongoose");
const Book = require("./models/book");
const Author = require("./models/author");
const User = require("./models/user");
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI;

const JWT_SECRET = process.env.JWT_SECRET;
const jwt = require("jsonwebtoken");

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.log("Error connecting to MongoDB:", error.message);
  });

const typeDefs = gql`
  type Book {
    title: String!
    published: Int!
    author: Author!
    id: ID!
    genres: [String!]!
  }

  type Author {
    name: String
    id: ID!
    born: Int
    bookCount: Int!
  }

  type User {
    username: String!
    favouriteGenre: String!
    id: ID!
  }

  type Token {
    value: String!
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
    me: User
  }

  type Mutation {
    addBook(
      title: String!
      author: String!
      published: Int!
      genres: [String!]!
    ): Book

    editAuthor(name: String!, setBornTo: Int!): Author

    createUser(username: String!, favouriteGenre: String!): User

    login(username: String!, password: String!): Token
  }

  type Subscription {
    bookAdded: Book!
  }
`;

const pubsub = new PubSub();

const resolvers = {
  Query: {
    bookCount: function () {
      return Book.collection.countDocuments();
    },
    authorCount: function () {
      return Author.collection.countDocuments();
    },
    allBooks: function (root, args) {
      if (!args.genre) {
        return Book.find({});
      }
      return Book.find({ genres: args.genre });
    },
    allAuthors: function () {
      return Author.find({});
    },
    me: function (root, args, context) {
      return context.currentUser;
    },
  },
  Book: {
    author: async function (root) {
      let authorID = root.author;
      let retrievedAuthor = await Author.findById(authorID);
      return retrievedAuthor;
    },
  },
  Author: {
    bookCount: async function (root) {
      let books = await Book.find({ author: root });
      return books.length;
    },
  },
  Mutation: {
    addBook: async (root, args, context) => {
      checkIfLoggedIn(context);
      let author = await Author.findOne({ name: args.author });
      try {
        if (!author) {
          let newAuthor = new Author({ name: args.author });
          author = newAuthor;
          await newAuthor.save();
        }
        const book = new Book({ ...args, author });
        pubsub.publish("BOOK_ADDED", { bookAdded: book });
        return book.save();
      } catch (error) {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        });
      }
    },

    editAuthor: function (root, args, context) {
      checkIfLoggedIn(context);
      const author = Author.findOneAndUpdate(
        { name: args.name },
        { born: args.setBornTo },
        {
          returnNewDocument: true,
        }
      );
      if (!author) {
        return null;
      }
      return author;
    },

    createUser: function (root, args) {
      const user = new User({
        username: args.username,
        favouriteGenre: args.favouriteGenre,
      });

      return user.save().catch((error) => {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        });
      });
    },

    login: async function (root, args) {
      const user = await User.findOne({ username: args.username });

      if (!user || args.password !== "secret") {
        throw new UserInputError("Wrong credentials");
      }

      const userForToken = {
        username: user.username,
        id: user._id,
      };
      return { value: jwt.sign(userForToken, JWT_SECRET) };
    },
  },
  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterator(["BOOK_ADDED"]),
    },
  },
};

function checkIfLoggedIn(context) {
  const currentUser = context.currentUser;
  if (!currentUser) {
    throw new AuthenticationError("Not authenticated");
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async function ({ req }) {
    const auth = req ? req.headers.authorization : null;
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      let decodedToken = jwt.verify(auth.substring(7), JWT_SECRET);
      const currentUser = await User.findById(decodedToken.id);
      return { currentUser };
    }
  },
});

server.listen().then(({ url, subscriptionsUrl }) => {
  console.log(`Server ready at ${url}`);
  console.log(`Subscriptions ready at ${subscriptionsUrl}`);
});
