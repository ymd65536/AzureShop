targetScope = 'resourceGroup'

@description('Azure region for Function App and supporting resources. Use a region with available quota, such as eastus2.')
param location string = 'eastus2'

@description('Azure region for the Static Web App. Static Web Apps is available in eastus2, westus2, centralus, eastasia, and westeurope.')
param staticWebAppLocation string = 'eastus2'

@description('Name of the web service resource for azd')
param webServiceName string = 'stapp-azure-shop-demo'

@description('Name of the Cosmos DB account')
param cosmosAccountName string = take(toLower('cosmos${uniqueString(subscription().subscriptionId, resourceGroup().id, location)}'), 44)

@description('Name of the Cosmos DB database')
param cosmosDatabaseName string = 'shopdb'

@description('Name of the Cosmos DB container')
param cosmosContainerName string = 'orders'

@description('Name of the Function App')
param functionAppName string = 'func-${uniqueString(subscription().subscriptionId, resourceGroup().id, location)}'

@description('Name of the storage account for the Function App')
param functionStorageAccountName string = take(toLower('st${uniqueString(subscription().subscriptionId, resourceGroup().id, location)}'), 24)

@description('Name of the Application Insights resource')
param appInsightsName string = 'appi-${uniqueString(resourceGroup().id, location)}'

@description('Name of the Consumption plan for the Function App')
param appServicePlanName string = 'asp-${uniqueString(resourceGroup().id, location)}'

resource webResource 'Microsoft.Web/staticSites@2023-12-01' = {
  name: webServiceName
  location: staticWebAppLocation
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

var functionStorageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${functionStorage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${functionStorage.listKeys().keys[0].value}'

resource functionStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: functionStorageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: null
    Flow_Type: 'Bluefield'
    Request_Source: 'rest'
  }
}

resource functionConsumptionPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp'
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: functionConsumptionPlan.id
    httpsOnly: true
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: functionStorageConnectionString
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'COSMOS_ENDPOINT'
          value: cosmosAccount.properties.documentEndpoint
        }
        {
          name: 'COSMOS_KEY'
          value: cosmosAccount.listKeys().primaryMasterKey
        }
        {
          name: 'COSMOS_DATABASE'
          value: cosmosDatabaseName
        }
        {
          name: 'COSMOS_CONTAINER'
          value: cosmosContainerName
        }
        {
          name: 'COSMOS_PRODUCTS_CONTAINER'
          value: 'products'
        }
      ]
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
    }
  }
}

output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output webUrl string = 'https://${webResource.properties.defaultHostname}'
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output applicationInsightsConnectionString string = appInsights.properties.ConnectionString
