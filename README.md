# Azure Shop Demo

このリポジトリは、Azure App Service、Azure SQL Database、Azure Functions、Azure Monitor、Application Insights、Azure Automation を組み合わせた架空のショッピングサイトのデモ用サンプルです。

## 構成

- Web UI: Azure App Service
- API/注文処理: Azure Functions
- データストア: Azure SQL Database
- 監視: Azure Monitor + Application Insights
- 運用自動化: Azure Automation

## 主要ファイル

- [azure.yaml](azure.yaml): Azure Developer CLI の構成
- [web/server.js](web/server.js): シンプルな Web アプリケーション
- [functions/src/functions.js](functions/src/functions.js): Azure Functions のサンプル
- [infra/main.bicep](infra/main.bicep): Azure リソースの IaC 定義

## 使い方

1. Azure CLI / Azure Developer CLI をインストールします。
2. Azure にログインします。
3. 次のコマンドでリソースをデプロイします。

```bash
azd auth login
azd up
```

## 監視・運用のポイント

- Application Insights で Web/API のトレースと依存関係を確認する
- Azure Monitor でメトリックとアラートを設定する
- Azure Automation で定期的な運用タスクを自動化する

## Azure Developer CLIのセットアップ

以下のコマンドを実行して、Azure Developer CLI (azd) をインストールします。

```bash
curl -fsSL https://aka.ms/install-azd.sh | bash
```

インストール方法は[公式ドキュメント](https://learn.microsoft.com/ja-jp/azure/developer/azure-developer-cli/install-azd)を参照してください。

### Azure Developer CLIの動作確認

以下のコマンドでAzure Developer CLIのバージョンを確認します。

```bash
azd version
```

### Azure Developer CLIでログインする

環境変数 `AZURE_TENANT_ID`が設定されている場合は、以下のコマンドでログインします。

```bash
azd auth login --tenant-id $AZURE_TENANT_ID
```

環境変数が設定されていない場合は、以下のコマンドでログインします。

```bash
azd auth login
```

## Azure CLIをセットアップする

以下のコマンドを実行して、Azure CLIをインストールします。

```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

インストール方法は[公式ドキュメント](https://learn.microsoft.com/ja-jp/cli/azure/install-azure-cli-linux?pivots=apt)を参照してください。

## Azure CLIでログインする

環境変数 `AZURE_TENANT_ID`が設定されている場合は、以下のコマンドでログインします。

```bash
az login --tenant $AZURE_TENANT_ID
```

### Azure CLIの動作確認

以下のコマンドでAzure CLIのバージョンとアカウント情報を確認します。

```bash
az version
az account list
```

## GitHub Codespacesの設定

`.env`でシークレットを管理する場合、以下のコマンドでCodespacesにシークレットを設定します。

```bash
gh secret set --app codespaces -f .env
```

シークレットの一覧を確認するには、以下のコマンドを実行します。

```bash
gh secret list --app codespaces
```

単一のシークレットを設定するには、以下のコマンドを使用します。

```bash
gh secret set --app codespaces SECRET_NAME
```

シークレットの削除は以下のコマンドで行います。

```bash
gh secret delete --app codespaces SECRET_NAME
```
