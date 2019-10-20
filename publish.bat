cd src/Squidex
npm run build
dotnet restore
dotnet publish --configuration Release --output "../../publish"