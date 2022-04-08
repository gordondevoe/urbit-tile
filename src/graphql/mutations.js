/* eslint-disable */
// this is an auto generated file. This will be overwritten

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