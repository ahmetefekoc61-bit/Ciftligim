# Çiftliğim API — bulut (Render) için Docker imajı
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Ciftligim.Api.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish Ciftligim.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
# Küpe yazısını okumak için Tesseract OCR + görüntü temizleme için ImageMagick
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng imagemagick \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 10000
ENTRYPOINT ["dotnet", "Ciftligim.Api.dll"]
