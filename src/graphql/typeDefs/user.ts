import gql from "graphql-tag";

const typeDefs = gql`
  scalar Date

  type User {
    id: String
    username: String
    avatar: String
  }

  type Query {
    searchUsers(username: String!): [User]
  }

  type Mutation {
    createUsername(username: String!, avatar: String): CreateUsernameResponse
  }

  type CreateUsernameResponse {
    success: Boolean
    error: String
  }
`;

export default typeDefs;
