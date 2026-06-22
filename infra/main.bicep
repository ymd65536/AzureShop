targetScope = 'resourceGroup'

@description('Azure region for the demo resources. Use a region with available quota, such as eastus2 or westus2.')
param location string = 'eastus2'

@description('Name of the web service resource for azd')
param webServiceName string = 'stapp-azure-shop-demo'

@description('Name of the Cosmos DB account')
param cosmosAccountName string = 'cosmosazureshopdemo20260622'

@description('Name of the Cosmos DB database')
param cosmosDatabaseName string = 'shopdb'

@description('Name of the Cosmos DB container')
param cosmosContainerName string = 'orders'

resource webResource 'Microsoft.Web/staticSites@2023-12-01' = {
  name: webServiceName
  location: location
  tags: {
    'azd-service-name': 'web'
  }
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    repositoryUrl: 'https://github.com/Azure/azure-quickstart-templates'
    branch: 'master'
    buildProperties: {
      appLocation: '/'
      apiLocation: '/api'
      outputLocation: ''
    }
  }
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosAccountName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
  }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: cosmosDatabaseName
  properties: {
    resource: {
      id: cosmosDatabaseName
    }
  }
}

resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDatabase
  name: cosmosContainerName
  properties: {
    resource: {
      id: cosmosContainerName
      partitionKey: {
        paths: [
          '/customerId'
        ]
        kind: 'Hash'
      }
    }
  }
}

output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output webUrl string = 'https://${webResource.properties.defaultHostname}'
