# OVT Correção Interativa

Este repositório contém somente os arquivos necessários para o OVT funcionar no GitHub Pages e para o conversor PPTX → PDF funcionar no Render.

## Estrutura correta da raiz

- index.html
- sw.js
- manifest.webmanifest
- ovt-192.png
- ovt-512.png
- server.js
- package.json
- Dockerfile
- render.yaml
- README.md

## O que NÃO precisa mais ficar no repositório

Arquivos Android/APK como:
- AndroidManifest.xml
- MainActivity.java
- activity_main.xml
- android-apk.yml
- build.gradle
- gradle.properties
- file_paths.xml
- strings.xml
- styles.xml
- ovt_icon.png

## Endereços usados

GitHub Pages:
https://felipescandian.github.io/fsovtregistros/

Conversor Render:
https://ovt-converter.onrender.com

## Fluxo

PDF:
WhatsApp/arquivo → OVT → abre direto.

PPTX:
WhatsApp/arquivo → OVT → Render converte para PDF → OVT abre para correção.

A devolutiva final mantém:
- PDF
- marcadores
- comentários
- áudios
- descontos
- nota final
- página de resultado
