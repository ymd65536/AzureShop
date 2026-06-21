# Azure Shop Demo

このリポジトリは、Cosmos DB を中心にした架空のショッピングサイトのデモ用サンプルです。現在の構成では、ローカルの Web サイトを起動しつつ、Azure 側では Cosmos DB を作成できるようにしています。

## 現在の構成

- フロントエンド: ローカル Node.js サーバーで動作する静的なショッピングサイト
- データストア: Azure Cosmos DB
- デプロイ基盤: Azure Developer CLI (azd) + Bicep

## 主要ファイル

- [azure.yaml](azure.yaml): Azure Developer CLI の構成
- [web/server.js](web/server.js): ローカル Web アプリケーション
- [web/public/index.html](web/public/index.html): ショッピングサイトの画面
- [infra/main.bicep](infra/main.bicep): Azure リソースの IaC 定義

## ローカルでの実行

```bash
cd web
npm install
node server.js
```

ブラウザで以下を開きます。

```text
http://127.0.0.1:8080
```

## Azure へのデプロイ

1. Azure CLI / Azure Developer CLI をインストールします。
2. Azure にログインします。
3. SQL 管理者パスワードを入力しながら、次のコマンドでデプロイします。
   パスワードは、8 文字以上で大文字・小文字・数字・記号を含むものを使用してください。

```bash
azd auth login
azd up
```

例: `SqlDemo!2026A` のような強いパスワードを使用してください。長さ 8 文字以上で、大文字・小文字・数字・記号を含む値を使ってください。

## 注意事項

- 現在の構成では App Service / Static Web Apps / Functions は含めていません。
- Cosmos DB の作成時には、サブスクリプションのリージョン制約と、アカウント名の一意性に注意してください。必要に応じて、リージョンを eastus2 など Static Web Apps が対応している地域に変更してください。
- 追加で監視や運用の要素を入れる場合は、後続で Application Insights や Azure Monitor を追加できます。

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
