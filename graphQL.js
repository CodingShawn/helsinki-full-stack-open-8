const { ApolloServer, gql } = require("apollo-server");
const mongoose = require("mongoose");
const Book = require("./models/book");
const Author = require("./models/author");
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI;

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

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
  }

  type Mutation {
    addBook(
      title: String!
      author: String!
      published: Int!
      genres: [String!]!
    ): Book

    editAuthor(name: String!, setBornTo: Int!): Author
  }
`;

const resolvers = {
  Query: {
    bookCount: function () {
      return Book.collection.countDocuments();
    },
    authorCount: function () {
      return Author.collection.countDocuments();
    },
    allBooks: function () {
      return Book.find({});
    },
    allAuthors: function () {
      return Author.find({});
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
    addBook: async (root, args) => {
      let author = await Author.findOne({ name: args.author });
      try {
        if (!author) {
          let newAuthor = new Author({ name: args.author });
          author = newAuthor;
          await newAuthor.save();
        }
        const book = new Book({ ...args, author });
        return book.save();
      } catch (error) {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        });
      }
    },

    editAuthor: function (root, args) {
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
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});
