/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createShip = /* GraphQL */ `
  mutation CreateShip(
    $input: CreateShipInput!
    $condition: ModelShipConditionInput
  ) {
    createShip(input: $input, condition: $condition) {
      id
      name
      location
      createdAt
      updatedAt
    }
  }
`;
export const updateShip = /* GraphQL */ `
  mutation UpdateShip(
    $input: UpdateShipInput!
    $condition: ModelShipConditionInput
  ) {
    updateShip(input: $input, condition: $condition) {
      id
      name
      location
      createdAt
      updatedAt
    }
  }
`;
export const deleteShip = /* GraphQL */ `
  mutation DeleteShip(
    $input: DeleteShipInput!
    $condition: ModelShipConditionInput
  ) {
    deleteShip(input: $input, condition: $condition) {
      id
      name
      location
      createdAt
      updatedAt
    }
  }
`;
