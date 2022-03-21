/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getShip = /* GraphQL */ `
  query GetShip($id: ID!) {
    getShip(id: $id) {
      id
      name
      location
      createdAt
      updatedAt
    }
  }
`;
export const listShips = /* GraphQL */ `
  query ListShips(
    $filter: ModelShipFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listShips(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        name
        location
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;
