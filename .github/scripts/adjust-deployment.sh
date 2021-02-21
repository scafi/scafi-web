#!/usr/bin/env bash
mkdir ./public
for asset in $(basename -a ./scafi-web/src/main/resources/*) ; do
  cp -r "./scafi-web/target/scala-2.12/classes/${asset}" ./public/ ;
done
mkdir -p ./public/js
cp "./scafi-web/target/scala-2.12/scalajs-bundler/main/scafi-web-opt-bundle.js" ./public/js
